use crate::error::{AppError, AppResult};
use encoding_rs::Encoding;
use std::path::Path;

/// Maximum raw bytes we will read from a `.txt` file (10 MB).
const MAX_TXT_BYTES: u64 = 10 * 1024 * 1024;

/// Extract text from a plain-text file, decoding common encodings.
pub fn extract(path: &Path) -> AppResult<String> {
    let meta = std::fs::metadata(path)?;
    if meta.len() > MAX_TXT_BYTES {
        return Err(AppError::Extract(format!(
            "txt: file too large ({} bytes)",
            meta.len()
        )));
    }
    let bytes = std::fs::read(path)?;

    // Honor a UTF-8/UTF-16 BOM if present, otherwise fall back to UTF-8 with
    // lossy replacement so we never fail on stray bytes.
    if let Some((enc, _)) = Encoding::for_bom(&bytes) {
        let (text, _, _) = enc.decode(&bytes);
        Ok(text.into_owned())
    } else {
        let (text, _, _) = encoding_rs::UTF_8.decode(&bytes);
        Ok(text.into_owned())
    }
}
