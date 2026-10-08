//! Application state: settings, data directory, and the SQLite handle.

use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::AppSettings;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

pub const PRODUCT_NAME: &str = "CandiShelf";
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
pub const AUTHOR: &str = "Tony";
pub const AUTHOR_URL: &str = "https://github.com/asfiles";
pub const HOMEPAGE: &str = "https://github.com/asfiles/CandiShelf";
pub const LICENSE: &str = "AGPL-3.0-or-later";

/// The application version as a Git tag (`0.1.0` -> `v0.1.0`). The release
/// workflow runs `npm run set-version <tag>` so this always equals the tag.
pub fn version_tag() -> String {
    format!("v{VERSION}")
}

pub struct AppState {
    inner: Mutex<Inner>,
}

struct Inner {
    settings: AppSettings,
    db: Db,
}

/// The default per-user data directory, following platform conventions.
pub fn default_data_dir() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(PRODUCT_NAME)
}

fn settings_path(data_dir: &Path) -> PathBuf {
    data_dir.join("settings.json")
}

fn db_path(data_dir: &Path) -> PathBuf {
    data_dir.join("candishelf.db")
}

fn originals_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("originals")
}

fn load_or_default_settings(data_dir: &Path) -> AppSettings {
    let path = settings_path(data_dir);
    if let Ok(text) = std::fs::read_to_string(&path) {
        if let Ok(mut s) = serde_json::from_str::<AppSettings>(&text) {
            s.version = VERSION.to_string();
            return s;
        }
    }
    AppSettings {
        data_dir: data_dir.to_string_lossy().to_string(),
        version: VERSION.to_string(),
        active_model: None,
        copy_originals: true,
    }
}

fn persist_settings(settings: &AppSettings) -> AppResult<()> {
    let dir = PathBuf::from(&settings.data_dir);
    std::fs::create_dir_all(&dir)?;
    let text = serde_json::to_string_pretty(settings)
        .map_err(|e| AppError::Io(e.to_string()))?;
    std::fs::write(settings_path(&dir), text)?;
    Ok(())
}

impl AppState {
    pub fn init() -> AppResult<Self> {
        let data_dir = default_data_dir();
        std::fs::create_dir_all(&data_dir)?;
        let settings = load_or_default_settings(&data_dir);
        // `active_model` stays None until the user completes the first-run
        // model step, which is what drives the welcome/model-download screen.
        let _ = persist_settings(&settings);

        let db = Db::open(&db_path(&data_dir))?;
        Ok(AppState {
            inner: Mutex::new(Inner { settings, db }),
        })
    }

    pub fn with_db<T>(&self, f: impl FnOnce(&Db) -> AppResult<T>) -> AppResult<T> {
        let guard = self.inner.lock().map_err(|_| AppError::Db("state lock poisoned".into()))?;
        f(&guard.db)
    }

    pub fn settings(&self) -> AppResult<AppSettings> {
        let guard = self.inner.lock().map_err(|_| AppError::Db("state lock poisoned".into()))?;
        Ok(guard.settings.clone())
    }

    pub fn data_dir(&self) -> AppResult<PathBuf> {
        Ok(PathBuf::from(self.settings()?.data_dir))
    }

    pub fn set_active_model(&self, id: Option<String>) -> AppResult<AppSettings> {
        let mut guard = self.inner.lock().map_err(|_| AppError::Db("state lock poisoned".into()))?;
        guard.settings.active_model = id;
        persist_settings(&guard.settings)?;
        Ok(guard.settings.clone())
    }

    pub fn set_copy_originals(&self, value: bool) -> AppResult<AppSettings> {
        let mut guard = self.inner.lock().map_err(|_| AppError::Db("state lock poisoned".into()))?;
        guard.settings.copy_originals = value;
        persist_settings(&guard.settings)?;
        Ok(guard.settings.clone())
    }

    /// Move to a new data directory: copies the DB across and re-opens it.
    pub fn set_data_dir(&self, new_dir: &Path) -> AppResult<AppSettings> {
        let mut guard = self.inner.lock().map_err(|_| AppError::Db("state lock poisoned".into()))?;
        std::fs::create_dir_all(new_dir)?;

        let old_db = db_path(Path::new(&guard.settings.data_dir));
        let new_db = db_path(new_dir);
        if old_db.exists() && old_db != new_db {
            std::fs::copy(&old_db, &new_db)?;
        }

        guard.settings.data_dir = new_dir.to_string_lossy().to_string();
        persist_settings(&guard.settings)?;
        guard.db = Db::open(&new_db)?;
        Ok(guard.settings.clone())
    }

    pub fn originals_dir(&self) -> AppResult<PathBuf> {
        Ok(originals_dir(&self.data_dir()?))
    }
}
