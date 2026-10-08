use crate::error::AppResult;
use std::path::Path;

/// Extract text from a PDF. Uses `pdf-extract`, which parses the content
/// streams for text only — it does not execute embedded JavaScript or follow
/// external references.
pub fn extract(path: &Path) -> AppResult<String> {
    // `pdf-extract` can panic on some malformed PDFs; contain it so one bad
    // file never crashes the app.
    let path = path.to_path_buf();
    let result = std::panic::catch_unwind(move || pdf_extract::extract_text(&path));
    match result {
        Ok(Ok(text)) => Ok(text),
        Ok(Err(e)) => Err(crate::error::AppError::Extract(format!("pdf: {e}"))),
        Err(_) => Err(crate::error::AppError::Extract(
            "pdf: parser panicked on malformed document".into(),
        )),
    }
}
