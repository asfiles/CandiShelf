//! Manual end-to-end check of real candle embeddings against sample resumes.
//!
//! Not part of the app. Run with:
//!   cargo run --release --example embed_cvs -- <model-id> <data-dir> <cv.pdf> [cv2.pdf ...]
//!
//! It downloads the model (if missing) into <data-dir>/models, embeds each CV
//! and a few queries, and prints a cosine-similarity ranking so we can eyeball
//! that semantic search actually works.

use candishelf_lib::testkit;
use std::path::PathBuf;

fn main() {
    let mut args = std::env::args().skip(1);
    let model_id = args.next().unwrap_or_else(|| "minilm-l6-en".to_string());
    let data_dir = PathBuf::from(
        args.next().unwrap_or_else(|| "/tmp/candishelf-embed-test".to_string()),
    );
    let cvs: Vec<PathBuf> = args.map(PathBuf::from).collect();
    if cvs.is_empty() {
        eprintln!("usage: embed_cvs <model-id> <data-dir> <cv.pdf> [more...]");
        std::process::exit(2);
    }

    println!("model = {model_id}\ndata_dir = {}", data_dir.display());
    testkit::run_embed_demo(&model_id, &data_dir, &cvs);
}
