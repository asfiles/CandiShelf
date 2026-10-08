//! Import pipeline: discover files, extract + parse each, embed, and store.
//! Per-file failures are collected and never abort the batch.

use crate::ai;
use crate::db::Db;
use crate::error::AppResult;
use crate::extract;
use crate::models::{Candidate, ImportError, ImportProgress, ImportSummary, ReindexProgress};
use crate::parser;
use crate::state::AppState;
use std::path::{Path, PathBuf};

/// Recursively collect supported files from a set of paths (files or dirs).
pub fn discover(paths: &[String]) -> Vec<PathBuf> {
    let mut out = Vec::new();
    for p in paths {
        let path = PathBuf::from(p);
        if path.is_dir() {
            collect_dir(&path, &mut out, 0);
        } else if path.is_file() && extract::is_supported(&path) {
            out.push(path);
        }
    }
    out.sort();
    out.dedup();
    out
}

fn collect_dir(dir: &Path, out: &mut Vec<PathBuf>, depth: usize) {
    if depth > 12 {
        return; // guard against symlink loops / pathological trees
    }
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_dir(&path, out, depth + 1);
        } else if path.is_file() && extract::is_supported(&path) {
            out.push(path);
        }
    }
}

/// Import a batch. `progress` is invoked after each file so the UI can update.
pub fn import_batch<F>(
    state: &AppState,
    paths: &[String],
    mut progress: F,
) -> AppResult<ImportSummary>
where
    F: FnMut(ImportProgress),
{
    let files = discover(paths);
    let settings = state.settings()?;
    let copy_originals = settings.copy_originals;
    // Product requirement: search is LLM-only, so a downloaded model must be
    // active before anything can be indexed. This validates it up front.
    let data_dir = state.data_dir()?;
    let model = ai::embedding_space(&data_dir, settings.active_model.as_deref())?;
    let originals_dir = state.originals_dir()?;
    if copy_originals {
        let _ = std::fs::create_dir_all(&originals_dir);
    }

    let mut summary = ImportSummary {
        found: files.len(),
        processed: 0,
        failed: Vec::new(),
    };

    for (i, file) in files.iter().enumerate() {
        progress(ImportProgress {
            found: files.len(),
            processed: i,
            current_file: file.to_string_lossy().to_string(),
        });

        match import_one(state, &data_dir, &model, file, copy_originals, &originals_dir) {
            Ok(()) => summary.processed += 1,
            Err(e) => summary.failed.push(ImportError {
                file: file.to_string_lossy().to_string(),
                error: e.to_string(),
            }),
        }
    }

    progress(ImportProgress {
        found: files.len(),
        processed: files.len(),
        current_file: String::new(),
    });
    Ok(summary)
}

fn import_one(
    state: &AppState,
    data_dir: &Path,
    model: &str,
    file: &Path,
    copy_originals: bool,
    originals_dir: &Path,
) -> AppResult<()> {
    let text = extract::extract_text(file)?;
    let parsed = parser::parse(&text);

    let stored_path = if copy_originals {
        copy_to_storage(file, originals_dir).ok()
    } else {
        None
    };

    let mut candidate = Candidate {
        source_path: file.to_string_lossy().to_string(),
        stored_path: stored_path.map(|p| p.to_string_lossy().to_string()),
        full_text: text.clone(),
        ..Default::default()
    };
    parser::apply_to_candidate(&mut candidate, parsed);

    let embed_src = embed_source(&candidate);
    let embedding = ai::embed(data_dir, Some(model), &embed_src)?;

    state.with_db(|db: &Db| {
        db.insert_candidate(&candidate, &embedding, model)?;
        Ok(())
    })
}

/// The text fed to the embedder for a candidate: full text plus the structured
/// signals that matter most for matching.
fn embed_source(c: &Candidate) -> String {
    format!(
        "{} {} {}",
        c.full_text,
        c.skills.join(" "),
        c.last_title.clone().unwrap_or_default()
    )
}

/// Copy a source file into app storage with a collision-safe name.
fn copy_to_storage(src: &Path, dir: &Path) -> AppResult<PathBuf> {
    let stem = src
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("resume");
    let ext = src.extension().and_then(|s| s.to_str()).unwrap_or("bin");

    // Sanitize the filename to avoid path traversal or odd characters.
    let safe_stem: String = stem
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .take(80)
        .collect();

    let mut candidate = dir.join(format!("{safe_stem}.{ext}"));
    let mut n = 1;
    while candidate.exists() {
        candidate = dir.join(format!("{safe_stem}_{n}.{ext}"));
        n += 1;
    }
    std::fs::copy(src, &candidate)?;
    Ok(candidate)
}

/// Re-run extraction/parsing for an existing candidate from its source file,
/// re-embedding with the active model.
pub fn reprocess(state: &AppState, id: i64) -> AppResult<Candidate> {
    let data_dir = state.data_dir()?;
    let model = ai::embedding_space(&data_dir, state.settings()?.active_model.as_deref())?;

    let existing = state.with_db(|db| db.get_candidate(id))?;
    let source = existing
        .stored_path
        .clone()
        .filter(|p| Path::new(p).exists())
        .unwrap_or_else(|| existing.source_path.clone());

    let text = extract::extract_text(Path::new(&source))?;
    let parsed = parser::parse(&text);

    let mut updated = existing.clone();
    updated.full_text = text;
    parser::apply_to_candidate(&mut updated, parsed);

    let embedding = ai::embed(&data_dir, Some(&model), &embed_source(&updated))?;
    state.with_db(|db| db.update_candidate(&updated, &embedding, &model))?;
    state.with_db(|db| db.get_candidate(id))
}

/// Re-embed every candidate whose stored vector was produced by a different
/// model than the active one. Called after the user changes/replaces the model
/// so existing candidates become searchable in the new embedding space.
/// `progress` is invoked after each candidate.
pub fn reindex_all<F>(state: &AppState, mut progress: F) -> AppResult<usize>
where
    F: FnMut(ReindexProgress),
{
    let data_dir = state.data_dir()?;
    let model = ai::embedding_space(&data_dir, state.settings()?.active_model.as_deref())?;

    let stale = state.with_db(|db| db.candidates_needing_embedding(&model))?;
    let total = stale.len();
    let mut processed = 0;

    for (id, _full_text) in stale {
        // Re-fetch to include skills/title in the embedding source.
        let candidate = state.with_db(|db| db.get_candidate(id))?;
        let embedding = ai::embed(&data_dir, Some(&model), &embed_source(&candidate))?;
        state.with_db(|db| db.update_embedding(id, &embedding, &model))?;
        processed += 1;
        progress(ReindexProgress {
            processed,
            total,
            done: false,
        });
    }

    progress(ReindexProgress {
        processed,
        total,
        done: true,
    });
    Ok(processed)
}
