//! Tauri command handlers — the IPC surface consumed by the React frontend.
//! Each returns `Result<_, AppError>` which serializes to a string on failure.

use crate::ai;
use crate::error::{AppError, AppResult};
use crate::importer;
use crate::models::*;
use crate::search;
use crate::state::{
    version_tag, AppState, AUTHOR, AUTHOR_URL, HOMEPAGE, LICENSE, PRODUCT_NAME, VERSION,
};
use crate::{db::Db, export};
use std::path::{Path, PathBuf};
use tauri::{Emitter, State};

// ---- Settings -------------------------------------------------------------

#[tauri::command]
pub fn get_settings(state: State<AppState>) -> AppResult<AppSettings> {
    state.settings()
}

#[tauri::command]
pub fn set_data_dir(state: State<AppState>, dir: String) -> AppResult<AppSettings> {
    state.set_data_dir(Path::new(&dir))
}

#[tauri::command]
pub fn set_copy_originals(state: State<AppState>, value: bool) -> AppResult<AppSettings> {
    state.set_copy_originals(value)
}

#[tauri::command]
pub fn check_for_updates() -> AppResult<String> {
    // Offline-first: no silent auto-update. Point users at Releases.
    Ok(format!(
        "You are on version {VERSION}. New versions are published on GitHub Releases; \
         updating means downloading the latest portable file."
    ))
}

#[tauri::command]
pub fn get_app_info() -> AppResult<AppInfo> {
    Ok(AppInfo {
        name: PRODUCT_NAME.to_string(),
        version: VERSION.to_string(),
        tag: version_tag(),
        author: AUTHOR.to_string(),
        author_url: AUTHOR_URL.to_string(),
        homepage: HOMEPAGE.to_string(),
        license: LICENSE.to_string(),
    })
}

// ---- Models ---------------------------------------------------------------

#[tauri::command]
pub fn list_models(state: State<AppState>) -> AppResult<Vec<ModelInfo>> {
    let dir = state.data_dir()?;
    let active = state.settings()?.active_model;
    Ok(ai::list_model_info(&dir, active.as_deref()))
}

/// Download a model (streaming byte progress), make it active, then re-embed
/// any existing candidates that were indexed with a different model.
#[tauri::command]
pub fn download_model(
    app: tauri::AppHandle,
    state: State<AppState>,
    id: String,
) -> AppResult<Vec<ModelInfo>> {
    let def = ai::find_model(&id).ok_or_else(|| AppError::NotFound(format!("model {id}")))?;
    let dir = state.data_dir()?;

    ai::download_model(&dir, def, |p| {
        let _ = app.emit("model-download-progress", &p);
    })?;

    // Activate the newly available model, then reindex existing candidates so
    // they are searchable in the new embedding space.
    state.set_active_model(Some(id.clone()))?;
    reindex_with_events(&app, state.inner())?;

    let active = state.settings()?.active_model;
    Ok(ai::list_model_info(&dir, active.as_deref()))
}

#[tauri::command]
pub fn delete_model(state: State<AppState>, id: String) -> AppResult<Vec<ModelInfo>> {
    let def = ai::find_model(&id).ok_or_else(|| AppError::NotFound(format!("model {id}")))?;
    let dir = state.data_dir()?;
    ai::delete_model(&dir, def)?;
    // If the active model was removed, clear it (the UI will require choosing a
    // model again — search is LLM-only).
    let settings = state.settings()?;
    if settings.active_model.as_deref() == Some(id.as_str()) {
        state.set_active_model(None)?;
    }
    let active = state.settings()?.active_model;
    Ok(ai::list_model_info(&dir, active.as_deref()))
}

/// Switch the active model to an already-downloaded model and re-embed the base.
#[tauri::command]
pub fn set_active_model(
    app: tauri::AppHandle,
    state: State<AppState>,
    id: String,
) -> AppResult<Vec<ModelInfo>> {
    let def = ai::find_model(&id).ok_or_else(|| AppError::NotFound(format!("model {id}")))?;
    let dir = state.data_dir()?;
    if !ai::is_downloaded(&dir, def) {
        return Err(AppError::Model(format!("model {id} is not downloaded")));
    }
    state.set_active_model(Some(id))?;
    reindex_with_events(&app, state.inner())?;
    let active = state.settings()?.active_model;
    Ok(ai::list_model_info(&dir, active.as_deref()))
}

/// How many candidates would need re-embedding if `id` became active — lets the
/// UI warn the user before switching models.
#[tauri::command]
pub fn model_change_impact(state: State<AppState>, id: String) -> AppResult<usize> {
    state.with_db(|db| db.count_stale_embeddings(&id))
}

fn reindex_with_events(app: &tauri::AppHandle, state: &AppState) -> AppResult<()> {
    importer::reindex_all(state, |p| {
        let _ = app.emit("reindex-progress", &p);
    })?;
    Ok(())
}

// ---- Candidates -----------------------------------------------------------

#[tauri::command]
pub fn list_candidates(
    state: State<AppState>,
    filters: Option<SearchFilters>,
) -> AppResult<Vec<CandidateSummary>> {
    let f = filters.unwrap_or_default();
    state.with_db(|db| db.list_summaries(&f))
}

#[tauri::command]
pub fn get_candidate(state: State<AppState>, id: i64) -> AppResult<Candidate> {
    state.with_db(|db| db.get_candidate(id))
}

#[tauri::command]
pub fn update_candidate(state: State<AppState>, candidate: Candidate) -> AppResult<Candidate> {
    // Re-embed the edited candidate with the active model so search stays
    // consistent with the manual corrections.
    let dir = state.data_dir()?;
    let model = ai::embedding_space(&dir, state.settings()?.active_model.as_deref())?;
    let embed_src = format!(
        "{} {} {}",
        candidate.full_text,
        candidate.skills.join(" "),
        candidate.last_title.clone().unwrap_or_default()
    );
    let embedding = ai::embed(&dir, Some(&model), &embed_src)?;
    state.with_db(|db| db.update_candidate(&candidate, &embedding, &model))?;
    state.with_db(|db| db.get_candidate(candidate.id))
}

#[tauri::command]
pub fn delete_candidate(state: State<AppState>, id: i64) -> AppResult<()> {
    // Remove the DB record (index + embeddings go with it) and any copied file.
    let stored = state.with_db(|db| db.delete_candidate(id))?;
    if let Some(path) = stored {
        let _ = std::fs::remove_file(path);
    }
    Ok(())
}

#[tauri::command]
pub fn reprocess_candidate(state: State<AppState>, id: i64) -> AppResult<Candidate> {
    importer::reprocess(state.inner(), id)
}

#[tauri::command]
pub fn open_original(state: State<AppState>, id: i64) -> AppResult<()> {
    let candidate = state.with_db(|db: &Db| db.get_candidate(id))?;
    let path = candidate
        .stored_path
        .filter(|p| Path::new(p).exists())
        .unwrap_or(candidate.source_path);
    if !Path::new(&path).exists() {
        return Err(AppError::NotFound(format!("original file: {path}")));
    }
    open_with_os(&path).map_err(|e| AppError::Io(format!("could not open file: {e}")))
}

/// Open an external URL in the OS default browser.
///
/// Security: only `http` and `https` are permitted. This blocks `file:`,
/// custom application schemes, and other vectors that could let a crafted
/// "link" launch something other than a browser. The URL is passed as a single
/// argv element (never through a shell), so it cannot be interpreted as a
/// command.
#[tauri::command]
pub fn open_url(url: String) -> AppResult<()> {
    let lower = url.trim().to_ascii_lowercase();
    if !(lower.starts_with("https://") || lower.starts_with("http://")) {
        return Err(AppError::Invalid(
            "only http(s) links can be opened".into(),
        ));
    }
    open_with_os(url.trim()).map_err(|e| AppError::Io(format!("could not open link: {e}")))
}

/// Hand a path or URL to the OS default handler. User-initiated only.
fn open_with_os(target: &str) -> std::io::Result<()> {
    #[cfg(target_os = "windows")]
    let child = std::process::Command::new("rundll32")
        .args(["url.dll,FileProtocolHandler", target])
        .spawn();
    #[cfg(target_os = "macos")]
    let child = std::process::Command::new("open").arg(target).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let child = std::process::Command::new("xdg-open").arg(target).spawn();

    child.map(|_| ())
}

// ---- Import ---------------------------------------------------------------

#[tauri::command]
pub fn import_paths(
    app: tauri::AppHandle,
    state: State<AppState>,
    paths: Vec<String>,
) -> AppResult<ImportSummary> {
    // A synchronous command runs on Tauri's blocking thread pool, so this
    // IO-heavy work does not stall the async runtime while it streams progress.
    importer::import_batch(state.inner(), &paths, |progress| {
        // Stream progress to the frontend; ignore emit errors.
        let _ = app.emit("import-progress", &progress);
    })
}

#[tauri::command]
pub fn clear_database(state: State<AppState>) -> AppResult<()> {
    let stored = state.with_db(|db| db.clear_all())?;
    for path in stored {
        let _ = std::fs::remove_file(path);
    }
    Ok(())
}

// ---- Search & matching ----------------------------------------------------

#[tauri::command]
pub fn search(
    state: State<AppState>,
    query: String,
    filters: Option<SearchFilters>,
) -> AppResult<Vec<SearchResult>> {
    let f = filters.unwrap_or_default();
    let dir = state.data_dir()?;
    let active = state.settings()?.active_model;
    state.with_db(|db| search::hybrid_search(db, &dir, active.as_deref(), &query, &f))
}

#[tauri::command]
pub fn match_job(state: State<AppState>, job_text: String) -> AppResult<JobMatchResponse> {
    let dir = state.data_dir()?;
    let active = state.settings()?.active_model;
    state.with_db(|db| search::match_job(db, &dir, active.as_deref(), &job_text))
}

// ---- Shortlist ------------------------------------------------------------

#[tauri::command]
pub fn set_shortlist(state: State<AppState>, id: i64, value: bool) -> AppResult<()> {
    state.with_db(|db| db.set_shortlist(id, value))
}

#[tauri::command]
pub fn export_shortlist_csv(state: State<AppState>) -> AppResult<String> {
    let out_dir: PathBuf = state.data_dir()?;
    let path = state.with_db(|db| export::export_shortlist(db, &out_dir))?;
    Ok(path.to_string_lossy().to_string())
}
