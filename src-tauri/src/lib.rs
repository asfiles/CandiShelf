//! CandiShelf library root: wires modules and registers Tauri commands.

mod ai;
mod commands;
mod db;
mod error;
mod export;
mod extract;
mod filters;
mod importer;
mod models;
mod parser;
mod search;
mod state;

#[cfg(feature = "candle")]
pub mod testkit;

use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Initialize app state (data dir, settings, DB) at startup.
            let state = AppState::init().map_err(|e| {
                Box::<dyn std::error::Error>::from(format!("init failed: {e}"))
            })?;
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_settings,
            commands::set_data_dir,
            commands::set_copy_originals,
            commands::check_for_updates,
            commands::get_app_info,
            commands::list_models,
            commands::download_model,
            commands::delete_model,
            commands::set_active_model,
            commands::model_change_impact,
            commands::list_candidates,
            commands::get_candidate,
            commands::update_candidate,
            commands::delete_candidate,
            commands::reprocess_candidate,
            commands::open_original,
            commands::open_url,
            commands::import_paths,
            commands::clear_database,
            commands::search,
            commands::match_job,
            commands::set_shortlist,
            commands::export_shortlist_csv,
        ])
        .run(tauri::generate_context!())
        .expect("error while running CandiShelf");
}
