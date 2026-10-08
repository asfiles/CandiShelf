use crate::error::{AppError, AppResult};
use quick_xml::events::Event;
use quick_xml::Reader;
use std::io::Read;
use std::path::Path;

/// Per-entry decompressed size cap (25 MB) — zip-bomb protection.
const MAX_ENTRY_BYTES: usize = 25 * 1024 * 1024;
/// Cap on the compressed archive we will open (50 MB).
const MAX_ARCHIVE_BYTES: u64 = 50 * 1024 * 1024;

/// Extract text from a DOCX file.
///
/// A DOCX is an OOXML ZIP archive. We only read `word/document.xml`, cap the
/// decompressed size, and pull out the runs of text (`<w:t>`), inserting
/// newlines for paragraph (`<w:p>`) and break (`<w:br>`) boundaries. We never
/// resolve relationships, load embedded objects, or follow external targets.
pub fn extract(path: &Path) -> AppResult<String> {
    let meta = std::fs::metadata(path)?;
    if meta.len() > MAX_ARCHIVE_BYTES {
        return Err(AppError::Extract(format!(
            "docx: archive too large ({} bytes)",
            meta.len()
        )));
    }

    let file = std::fs::File::open(path)?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| AppError::Extract(format!("docx: not a valid archive: {e}")))?;

    let mut xml = match archive.by_name("word/document.xml") {
        Ok(entry) => {
            if entry.size() as usize > MAX_ENTRY_BYTES {
                return Err(AppError::Extract(
                    "docx: document part exceeds size limit".into(),
                ));
            }
            let mut buf = String::new();
            // Limit the reader to MAX_ENTRY_BYTES regardless of declared size.
            entry
                .take(MAX_ENTRY_BYTES as u64)
                .read_to_string(&mut buf)
                .map_err(|e| AppError::Extract(format!("docx: read failed: {e}")))?;
            buf
        }
        Err(_) => {
            return Err(AppError::Extract(
                "docx: missing word/document.xml".into(),
            ))
        }
    };

    let text = parse_document_xml(&xml)?;
    xml.clear();
    Ok(text)
}

fn parse_document_xml(xml: &str) -> AppResult<String> {
    // `&[u8]` implements BufRead, enabling the buffered event reader.
    let mut reader = Reader::from_reader(xml.as_bytes());

    let mut out = String::new();
    let mut in_text = false;
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                let name = local_name(e.name().as_ref());
                if name == "t" {
                    in_text = true;
                }
            }
            Ok(Event::End(e)) => {
                let name = local_name(e.name().as_ref());
                match name.as_str() {
                    "t" => in_text = false,
                    "p" => out.push('\n'),
                    _ => {}
                }
            }
            Ok(Event::Empty(e)) => {
                let name = local_name(e.name().as_ref());
                if name == "br" || name == "cr" {
                    out.push('\n');
                } else if name == "tab" {
                    out.push('\t');
                }
            }
            Ok(Event::Text(e)) => {
                if in_text {
                    let decoded = e
                        .unescape()
                        .map_err(|err| AppError::Extract(format!("docx: xml: {err}")))?;
                    out.push_str(&decoded);
                    if out.len() > MAX_ENTRY_BYTES {
                        break;
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => {
                return Err(AppError::Extract(format!("docx: xml parse error: {e}")))
            }
            _ => {}
        }
        buf.clear();
    }

    Ok(out)
}

/// Strip an XML namespace prefix (`w:t` -> `t`).
fn local_name(raw: &[u8]) -> String {
    let s = String::from_utf8_lossy(raw);
    match s.rsplit(':').next() {
        Some(local) => local.to_string(),
        None => s.to_string(),
    }
}
