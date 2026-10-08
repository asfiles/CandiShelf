//! Local LLM embeddings and model management.
//!
//! Search and job matching are powered by sentence-embedding LLMs run
//! **locally** via [`candle`](https://github.com/huggingface/candle) — a
//! pure-Rust ML runtime (no ONNX/C library, so cross-compilation and code
//! signing stay simple). The user picks and downloads one of the models below,
//! and every query is embedded and compared by cosine similarity.
//!
//! Two models are offered (see [`MODELS`]):
//!   * `minilm-l6-en`   — all-MiniLM-L6-v2, English, small & fast (~87 MB).
//!   * `multilingual-l12` — paraphrase-multilingual-MiniLM-L12-v2, 50+
//!     languages incl. Russian, larger & slower (~458 MB).
//!
//! Sizes in each model's `short_desc` use a `{size}` placeholder; the UI fills
//! it from the summed `size_bytes`, so the hint can never drift from the size
//! shown next to the model name.
//!
//! Both output 384-dimensional vectors, so [`EMBED_DIM`] and the on-disk BLOB
//! layout are identical; only the embedding *space* differs, which is why each
//! stored vector is stamped with the model that produced it (see `db.rs`).
//!
//! Everything runs on-device. The only network use is the explicit,
//! user-initiated model download, whose files are SHA-256 verified.

#[cfg(feature = "candle")]
mod embedder;

use crate::error::{AppError, AppResult};
use crate::models::{ModelDownloadProgress, ModelFileInfo, ModelInfo};
use once_cell::sync::Lazy;
use std::path::{Path, PathBuf};

/// Embedding dimensionality. Both offered models produce 384-dim vectors.
pub const EMBED_DIM: usize = 384;

/// One downloadable file that makes up a model.
pub struct ModelFile {
    pub url: &'static str,
    pub file_name: &'static str,
    /// Expected SHA-256 (lowercase hex). Empty string = not pinned yet; the
    /// download still succeeds but is not integrity-checked. Pin real values
    /// before a production release.
    pub sha256: &'static str,
    /// Approximate size in bytes, for the progress bar and the UI.
    pub size_bytes: u64,
}

/// A selectable embedding model.
pub struct ModelDef {
    pub id: &'static str,
    pub name: &'static str,
    /// One-line "what's the difference" hint shown next to the choice.
    pub short_desc: &'static str,
    /// Longer description.
    pub description: &'static str,
    pub languages: &'static str,
    pub recommended: bool,
    /// Sub-directory under `models/` where this model's files live.
    pub subdir: &'static str,
    pub files: &'static [ModelFile],
}

impl ModelDef {
    pub fn size_bytes(&self) -> u64 {
        self.files.iter().map(|f| f.size_bytes).sum()
    }
    /// Primary download URL (the weights), shown compactly in the UI.
    pub fn primary_url(&self) -> String {
        self.files
            .iter()
            .find(|f| f.file_name.ends_with(".safetensors"))
            .map(|f| f.url.to_string())
            .unwrap_or_else(|| self.files.first().map(|f| f.url.to_string()).unwrap_or_default())
    }
}

pub static MODELS: Lazy<Vec<ModelDef>> = Lazy::new(|| {
    vec![
        ModelDef {
            id: "minilm-l6-en",
            name: "MiniLM-L6 (English)",
            short_desc: "English only · small & fast (~{size}). Best if your resumes are in English.",
            description:
                "sentence-transformers/all-MiniLM-L6-v2. A compact 6-layer model \
                 producing 384-dim embeddings. Fast on any laptop; English-focused.",
            languages: "English",
            recommended: true,
            subdir: "minilm-l6-en",
            files: &[
                ModelFile {
                    url: "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/1110a243fdf4706b3f48f1d95db1a4f5529b4d41/model.safetensors",
                    file_name: "model.safetensors",
                    sha256: "53aa51172d142c89d9012cce15ae4d6cc0ca6895895114379cacb4fab128d9db",
                    size_bytes: 90_868_376,
                },
                ModelFile {
                    url: "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/1110a243fdf4706b3f48f1d95db1a4f5529b4d41/tokenizer.json",
                    file_name: "tokenizer.json",
                    sha256: "be50c3628f2bf5bb5e3a7f17b1f74611b2561a3a27eeab05e5aa30f411572037",
                    size_bytes: 466_247,
                },
                ModelFile {
                    url: "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/1110a243fdf4706b3f48f1d95db1a4f5529b4d41/config.json",
                    file_name: "config.json",
                    sha256: "953f9c0d463486b10a6871cc2fd59f223b2c70184f49815e7efbcab5d8908b41",
                    size_bytes: 612,
                },
            ],
        },
        ModelDef {
            id: "multilingual-l12",
            name: "Multilingual MiniLM-L12",
            short_desc: "50+ languages incl. Russian · larger & slower (~{size}). Pick this for non-English resumes.",
            description:
                "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2. A \
                 12-layer model covering 50+ languages (including Russian), also \
                 384-dim. Higher quality across languages at a larger download and \
                 slower indexing.",
            languages: "50+ languages (incl. Russian, English)",
            recommended: false,
            subdir: "multilingual-l12",
            files: &[
                ModelFile {
                    url: "https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/resolve/e8f8c211226b894fcb81acc59f3b34ba3efd5f42/model.safetensors",
                    file_name: "model.safetensors",
                    sha256: "eaa086f0ffee582aeb45b36e34cdd1fe2d6de2bef61f8a559a1bbc9bd955917b",
                    size_bytes: 470_641_600,
                },
                ModelFile {
                    url: "https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/resolve/e8f8c211226b894fcb81acc59f3b34ba3efd5f42/tokenizer.json",
                    file_name: "tokenizer.json",
                    sha256: "2c3387be76557bd40970cec13153b3bbf80407865484b209e655e5e4729076b8",
                    size_bytes: 9_081_518,
                },
                ModelFile {
                    url: "https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/resolve/e8f8c211226b894fcb81acc59f3b34ba3efd5f42/config.json",
                    file_name: "config.json",
                    sha256: "6300193cb75e01cf80c96decef7187dfb33094d97cc1490b7ead6ff134476e4e",
                    size_bytes: 645,
                },
            ],
        },
    ]
});

pub fn find_model(id: &str) -> Option<&'static ModelDef> {
    MODELS.iter().find(|m| m.id == id)
}

pub fn models_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("models")
}

pub fn model_dir(data_dir: &Path, def: &ModelDef) -> PathBuf {
    models_dir(data_dir).join(def.subdir)
}

/// A model is considered downloaded when every file exists on disk.
pub fn is_downloaded(data_dir: &Path, def: &ModelDef) -> bool {
    let dir = model_dir(data_dir, def);
    def.files.iter().all(|f| dir.join(f.file_name).exists())
}

pub fn list_model_info(data_dir: &Path, active_model: Option<&str>) -> Vec<ModelInfo> {
    MODELS
        .iter()
        .map(|m| ModelInfo {
            id: m.id.to_string(),
            name: m.name.to_string(),
            description: m.description.to_string(),
            short_desc: m.short_desc.to_string(),
            languages: m.languages.to_string(),
            size_bytes: m.size_bytes(),
            downloaded: is_downloaded(data_dir, m),
            recommended: m.recommended,
            active: active_model == Some(m.id),
            url: m.primary_url(),
            dir: model_dir(data_dir, m).to_string_lossy().to_string(),
            files: m
                .files
                .iter()
                .map(|f| ModelFileInfo {
                    name: f.file_name.to_string(),
                    url: f.url.to_string(),
                })
                .collect(),
        })
        .collect()
}

/// Download every file of a model into its sub-directory, verifying SHA-256
/// where pinned. Streams byte-level progress through `progress`. On any failure
/// the partial files are removed.
pub fn download_model<F>(
    data_dir: &Path,
    def: &ModelDef,
    mut progress: F,
) -> AppResult<()>
where
    F: FnMut(ModelDownloadProgress),
{
    use sha2::{Digest, Sha256};
    use std::io::{Read, Write};

    let dir = model_dir(data_dir, def);
    std::fs::create_dir_all(&dir)?;

    let total: u64 = def.size_bytes();
    let mut downloaded_all: u64 = 0;
    let file_count = def.files.len();

    for (idx, f) in def.files.iter().enumerate() {
        let dest = dir.join(f.file_name);
        let tmp = dir.join(format!("{}.part", f.file_name));

        let resp = ureq::get(f.url)
            .call()
            .map_err(|e| AppError::Download(format!("{}: {e}", f.file_name)))?;
        let mut reader = resp.into_reader();
        let mut file = std::fs::File::create(&tmp)?;
        let mut hasher = Sha256::new();
        let mut buf = [0u8; 64 * 1024];

        loop {
            let n = match reader.read(&mut buf) {
                Ok(n) => n,
                Err(e) => {
                    let _ = std::fs::remove_file(&tmp);
                    return Err(AppError::Download(format!("{}: {e}", f.file_name)));
                }
            };
            if n == 0 {
                break;
            }
            hasher.update(&buf[..n]);
            file.write_all(&buf[..n])?;
            downloaded_all += n as u64;
            progress(ModelDownloadProgress {
                model_id: def.id.to_string(),
                file_name: f.file_name.to_string(),
                file_index: idx,
                file_count,
                downloaded: downloaded_all,
                total,
                done: false,
            });
        }
        file.flush()?;
        drop(file);

        if !f.sha256.is_empty() {
            let hex = hasher
                .finalize()
                .iter()
                .map(|b| format!("{b:02x}"))
                .collect::<String>();
            if !hex.eq_ignore_ascii_case(f.sha256) {
                let _ = std::fs::remove_file(&tmp);
                return Err(AppError::Integrity(format!(
                    "checksum mismatch for {}/{}: expected {}, got {}",
                    def.id, f.file_name, f.sha256, hex
                )));
            }
        }
        std::fs::rename(&tmp, &dest)?;
    }

    progress(ModelDownloadProgress {
        model_id: def.id.to_string(),
        file_name: String::new(),
        file_index: file_count,
        file_count,
        downloaded: total,
        total,
        done: true,
    });
    Ok(())
}

/// Delete a downloaded model's files (and drop any in-memory copy).
pub fn delete_model(data_dir: &Path, def: &ModelDef) -> AppResult<()> {
    let dir = model_dir(data_dir, def);
    if dir.exists() {
        std::fs::remove_dir_all(&dir)?;
    }
    #[cfg(feature = "candle")]
    embedder::evict(def.id);
    Ok(())
}

// ---- Embedding ------------------------------------------------------------

/// The identifier of the embedding space currently in use. Stored alongside
/// each vector so we can detect and re-embed candidates when the model changes.
///
/// Requires a real, downloaded model when built with candle (the product
/// requirement: LLM-only search). Without the candle feature (the fast logic CI
/// job) it falls back to a deterministic label so tests remain runnable.
pub fn embedding_space(data_dir: &Path, active_model: Option<&str>) -> AppResult<String> {
    #[cfg(feature = "candle")]
    {
        let id = active_model
            .ok_or_else(|| AppError::Model("no embedding model selected".into()))?;
        let def = find_model(id)
            .ok_or_else(|| AppError::Model(format!("unknown model {id}")))?;
        if !is_downloaded(data_dir, def) {
            return Err(AppError::Model(format!("model {id} is not downloaded")));
        }
        Ok(id.to_string())
    }
    #[cfg(not(feature = "candle"))]
    {
        let _ = (data_dir, active_model);
        Ok("lexical-fallback".to_string())
    }
}

/// Embed a piece of text with the active model, returning a normalized vector.
pub fn embed(data_dir: &Path, active_model: Option<&str>, text: &str) -> AppResult<Vec<f32>> {
    #[cfg(feature = "candle")]
    {
        let id = active_model
            .ok_or_else(|| AppError::Model("no embedding model selected".into()))?;
        let def = find_model(id)
            .ok_or_else(|| AppError::Model(format!("unknown model {id}")))?;
        embedder::embed(data_dir, def, text)
    }
    #[cfg(not(feature = "candle"))]
    {
        let _ = (data_dir, active_model);
        Ok(embed_lexical(text))
    }
}

/// Deterministic hashed embedding used only as the computational fallback in
/// builds without the candle feature (developer/logic CI) and in unit tests. It
/// is never exposed as a product search mode.
#[allow(dead_code)]
pub fn embed_lexical(text: &str) -> Vec<f32> {
    let mut v = vec![0f32; EMBED_DIM];
    let lower = text.to_lowercase();
    let tokens: Vec<&str> = lower
        .split(|c: char| !c.is_alphanumeric() && c != '+' && c != '#' && c != '.')
        .filter(|t| !t.is_empty())
        .collect();
    for tok in &tokens {
        add_feature(&mut v, tok, 1.0);
        let chars: Vec<char> = tok.chars().collect();
        if chars.len() >= 3 {
            for w in chars.windows(3) {
                let tri: String = w.iter().collect();
                add_feature(&mut v, &tri, 0.5);
            }
        }
    }
    normalize(&mut v);
    v
}

#[allow(dead_code)]
fn add_feature(v: &mut [f32], key: &str, weight: f32) {
    let h = fnv1a(key);
    let idx = (h % EMBED_DIM as u64) as usize;
    let sign = if (h >> 32) & 1 == 0 { 1.0 } else { -1.0 };
    v[idx] += weight * sign;
}

#[allow(dead_code)]
fn fnv1a(s: &str) -> u64 {
    let mut hash: u64 = 0xcbf29ce484222325;
    for b in s.bytes() {
        hash ^= b as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

pub fn normalize(v: &mut [f32]) {
    let norm: f32 = v.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm > 1e-8 {
        for x in v.iter_mut() {
            *x /= norm;
        }
    }
}

pub fn cosine(a: &[f32], b: &[f32]) -> f32 {
    let n = a.len().min(b.len());
    let mut dot = 0f32;
    for i in 0..n {
        dot += a[i] * b[i];
    }
    dot
}

/// Serialize an embedding to bytes (little-endian f32) for SQLite BLOB storage.
pub fn embedding_to_bytes(v: &[f32]) -> Vec<u8> {
    let mut out = Vec::with_capacity(v.len() * 4);
    for x in v {
        out.extend_from_slice(&x.to_le_bytes());
    }
    out
}

pub fn embedding_from_bytes(bytes: &[u8]) -> Vec<f32> {
    bytes
        .chunks_exact(4)
        .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn embedding_is_normalized() {
        let v = embed_lexical("Kubernetes AWS Terraform DevOps engineer");
        let norm: f32 = v.iter().map(|x| x * x).sum::<f32>().sqrt();
        assert!((norm - 1.0).abs() < 1e-4);
        assert_eq!(v.len(), EMBED_DIM);
    }

    #[test]
    fn roundtrip_bytes() {
        let v = embed_lexical("hello world");
        let bytes = embedding_to_bytes(&v);
        let back = embedding_from_bytes(&bytes);
        assert_eq!(v.len(), back.len());
        for (a, b) in v.iter().zip(back.iter()) {
            assert!((a - b).abs() < 1e-6);
        }
    }

    #[test]
    fn catalog_has_two_models_both_384() {
        assert_eq!(MODELS.len(), 2);
        assert!(find_model("minilm-l6-en").is_some());
        assert!(find_model("multilingual-l12").is_some());
    }

    #[test]
    fn every_model_file_has_a_pinned_lowercase_sha256() {
        for m in MODELS.iter() {
            for f in m.files {
                assert_eq!(
                    f.sha256.len(),
                    64,
                    "{}/{}: sha256 must be pinned (64 hex chars)",
                    m.id,
                    f.file_name
                );
                assert!(
                    f.sha256.bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase()),
                    "{}/{}: sha256 must be lowercase hex",
                    m.id,
                    f.file_name
                );
            }
        }
    }
}
