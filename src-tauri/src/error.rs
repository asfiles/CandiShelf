use serde::Serialize;

/// Application-wide error type. Serializes to a plain string so the frontend
/// receives a readable message from every `invoke`.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("database error: {0}")]
    Db(String),

    #[error("io error: {0}")]
    Io(String),

    #[error("unsupported file type: {0}")]
    Unsupported(String),

    #[error("extraction failed: {0}")]
    Extract(String),

    #[error("model error: {0}")]
    Model(String),

    #[error("download failed: {0}")]
    Download(String),

    #[error("integrity check failed: {0}")]
    Integrity(String),

    #[error("not found: {0}")]
    NotFound(String),

    #[error("invalid input: {0}")]
    Invalid(String),
}

impl From<rusqlite::Error> for AppError {
    fn from(e: rusqlite::Error) -> Self {
        AppError::Db(e.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::Io(e.to_string())
    }
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
