//! candle-backed sentence embedder (BERT / MiniLM family).
//!
//! Loads a downloaded model (safetensors weights + tokenizer.json + config.json)
//! and produces mean-pooled, L2-normalized sentence embeddings. Loaded models
//! are cached in memory so repeated queries and batch indexing don't re-read the
//! weights. All computation is on the CPU — no network, no GPU dependency.

use crate::ai::{model_dir, ModelDef, EMBED_DIM};
use crate::error::{AppError, AppResult};
use candle_core::{DType, Device, Tensor};
use candle_nn::VarBuilder;
use candle_transformers::models::bert::{BertModel, Config};
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, Mutex};
use tokenizers::Tokenizer;

/// A ready-to-use embedding model held in memory.
struct Loaded {
    model: BertModel,
    tokenizer: Tokenizer,
}

/// Cache of loaded models keyed by model id. `BertModel` is not `Sync`, so the
/// whole entry sits behind a `Mutex`; embedding is CPU-bound and serialized per
/// model, which is fine for a desktop app.
static CACHE: Lazy<Mutex<HashMap<String, Arc<Mutex<Loaded>>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// Drop a model from the in-memory cache (called when it is deleted).
pub fn evict(model_id: &str) {
    if let Ok(mut cache) = CACHE.lock() {
        cache.remove(model_id);
    }
}

fn load(data_dir: &Path, def: &ModelDef) -> AppResult<Arc<Mutex<Loaded>>> {
    if let Some(existing) = CACHE.lock().ok().and_then(|c| c.get(def.id).cloned()) {
        return Ok(existing);
    }

    let dir = model_dir(data_dir, def);
    let weights = dir.join("model.safetensors");
    let tok_path = dir.join("tokenizer.json");
    let cfg_path = dir.join("config.json");
    for p in [&weights, &tok_path, &cfg_path] {
        if !p.exists() {
            return Err(AppError::Model(format!(
                "model file missing: {}",
                p.display()
            )));
        }
    }

    let config: Config = serde_json::from_slice(&std::fs::read(&cfg_path)?)
        .map_err(|e| AppError::Model(format!("config.json: {e}")))?;

    let mut tokenizer = Tokenizer::from_file(&tok_path)
        .map_err(|e| AppError::Model(format!("tokenizer.json: {e}")))?;
    // Enable padding/truncation so batches and long resumes are handled safely.
    tokenizer
        .with_padding(Some(tokenizers::PaddingParams::default()))
        .with_truncation(Some(tokenizers::TruncationParams {
            max_length: 256,
            ..Default::default()
        }))
        .map_err(|e| AppError::Model(format!("tokenizer config: {e}")))?;

    let device = Device::Cpu;
    let vb = unsafe {
        VarBuilder::from_mmaped_safetensors(&[weights], DType::F32, &device)
            .map_err(|e| AppError::Model(format!("weights: {e}")))?
    };
    let model = BertModel::load(vb, &config)
        .map_err(|e| AppError::Model(format!("bert load: {e}")))?;

    let loaded = Arc::new(Mutex::new(Loaded { model, tokenizer }));
    if let Ok(mut cache) = CACHE.lock() {
        cache.insert(def.id.to_string(), loaded.clone());
    }
    Ok(loaded)
}

/// Embed one text into a normalized 384-dim vector.
pub fn embed(data_dir: &Path, def: &ModelDef, text: &str) -> AppResult<Vec<f32>> {
    let handle = load(data_dir, def)?;
    let loaded = handle.lock().map_err(|_| AppError::Model("embedder lock poisoned".into()))?;

    // Empty input -> zero vector (avoids a degenerate model call).
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Ok(vec![0f32; EMBED_DIM]);
    }

    let encoding = loaded
        .tokenizer
        .encode(trimmed, true)
        .map_err(|e| AppError::Model(format!("tokenize: {e}")))?;

    let device = &Device::Cpu;
    let ids: Vec<u32> = encoding.get_ids().to_vec();
    let mask: Vec<u32> = encoding.get_attention_mask().to_vec();
    let seq_len = ids.len();

    let token_ids = Tensor::new(ids.as_slice(), device)
        .and_then(|t| t.reshape((1, seq_len)))
        .map_err(tensor_err)?;
    let attention = Tensor::new(mask.as_slice(), device)
        .and_then(|t| t.reshape((1, seq_len)))
        .map_err(tensor_err)?;
    let token_type_ids = token_ids.zeros_like().map_err(tensor_err)?;

    // BERT forward. candle-transformers' bert signature is
    // forward(input_ids, token_type_ids, attention_mask?).
    let output = loaded
        .model
        .forward(&token_ids, &token_type_ids, Some(&attention))
        .map_err(|e| AppError::Model(format!("bert forward: {e}")))?;

    let pooled = mean_pool(&output, &attention).map_err(tensor_err)?;
    let mut v: Vec<f32> = pooled.to_vec1::<f32>().map_err(tensor_err)?;
    crate::ai::normalize(&mut v);
    Ok(v)
}

/// Attention-masked mean pooling over the token dimension.
/// `hidden`: (1, seq, dim); `mask`: (1, seq). Returns (dim).
fn mean_pool(hidden: &Tensor, mask: &Tensor) -> candle_core::Result<Tensor> {
    let (_b, seq, dim) = hidden.dims3()?;
    // (1, seq) -> (1, seq, 1) -> (1, seq, dim) as f32
    let mask_f = mask
        .to_dtype(DType::F32)?
        .reshape((1, seq, 1))?
        .broadcast_as((1, seq, dim))?;
    let summed = (hidden * &mask_f)?.sum(1)?; // (1, dim)
    let counts = mask_f.sum(1)?; // (1, dim)
    let mean = (summed / counts)?; // (1, dim)
    mean.reshape((dim,))
}

fn tensor_err(e: candle_core::Error) -> AppError {
    AppError::Model(format!("tensor: {e}"))
}
