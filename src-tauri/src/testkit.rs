//! Manual test helpers exposed for the `embed_cvs` example. Not used by the app
//! at runtime. Kept behind the `candle` feature since it performs real
//! embedding inference.

#![cfg(feature = "candle")]

use crate::{ai, extract, parser};
use std::path::Path;

/// Download the model if needed, embed each resume + a set of demo queries,
/// and print a cosine-similarity ranking per query.
pub fn run_embed_demo(model_id: &str, data_dir: &Path, cvs: &[std::path::PathBuf]) {
    let def = match ai::find_model(model_id) {
        Some(d) => d,
        None => {
            eprintln!("unknown model id: {model_id}");
            std::process::exit(2);
        }
    };

    if !ai::is_downloaded(data_dir, def) {
        println!("downloading model ({} MB)…", def.size_bytes() / 1_000_000);
        let mut last = 0u64;
        ai::download_model(data_dir, def, |p| {
            if p.downloaded - last > 10_000_000 || p.done {
                last = p.downloaded;
                println!(
                    "  {} / {} MB",
                    p.downloaded / 1_000_000,
                    p.total / 1_000_000
                );
            }
        })
        .expect("download failed");
    }

    // Extract + embed each CV.
    let mut docs: Vec<(String, Vec<f32>, String)> = Vec::new();
    for cv in cvs {
        let text = match extract::extract_text(cv) {
            Ok(t) => t,
            Err(e) => {
                eprintln!("extract {}: {e}", cv.display());
                continue;
            }
        };
        let parsed = parser::parse(&text);
        let name = if parsed.name.is_empty() {
            cv.file_name().unwrap().to_string_lossy().to_string()
        } else {
            parsed.name.clone()
        };
        let src = format!("{} {} {}", text, parsed.skills.join(" "), parsed.last_title.clone().unwrap_or_default());
        let emb = ai::embed(data_dir, Some(model_id), &src).expect("embed cv");
        println!(
            "\n=== {} ===\n  parsed title: {:?}\n  skills: {:?}\n  chars: {}",
            name,
            parsed.last_title,
            parsed.skills,
            text.len()
        );
        docs.push((name, emb, src.chars().take(160).collect()));
    }

    let queries = [
        "DevOps engineer with Kubernetes and AWS",
        "technical support team lead",
        "frontend developer React TypeScript",
        "security engineer cloud infrastructure",
    ];

    for q in queries {
        let qv = ai::embed(data_dir, Some(model_id), q).expect("embed query");
        let mut ranked: Vec<(&str, f32)> = docs
            .iter()
            .map(|(name, emb, _)| (name.as_str(), ai::cosine(&qv, emb)))
            .collect();
        ranked.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        println!("\nQUERY: {q}");
        for (name, score) in ranked {
            println!("  {:>6.1}%  {}", score * 100.0, name);
        }
    }
}
