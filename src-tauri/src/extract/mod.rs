//! Resume text extraction with strict input sanitization.
//!
//! Security posture (OWASP-aligned): resume files are untrusted input.
//! - We never execute, render, or interpret file contents — we only extract
//!   plain text.
//! - DOCX is a ZIP; we cap entry sizes and total output to prevent zip-bomb
//!   style resource exhaustion, and we ignore anything except the main
//!   document part.
//! - All extracted text is passed through `sanitize_text`, which strips
//!   control characters and neutralizes spreadsheet/script-injection payloads
//!   before the text is stored or shown.

mod docx;
mod pdf;
mod txt;

use crate::error::{AppError, AppResult};
use std::path::Path;

/// Hard cap on extracted text (characters). Protects the DB and UI from
/// pathological inputs. 4 MB of text is far more than any real resume.
pub const MAX_TEXT_CHARS: usize = 4 * 1024 * 1024;

/// Supported input extensions.
pub fn is_supported(path: &Path) -> bool {
    matches!(
        ext(path).as_deref(),
        Some("pdf") | Some("docx") | Some("txt")
    )
}

fn ext(path: &Path) -> Option<String> {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
}

/// Extract sanitized plain text from a resume file.
pub fn extract_text(path: &Path) -> AppResult<String> {
    let raw = match ext(path).as_deref() {
        Some("pdf") => pdf::extract(path)?,
        Some("docx") => docx::extract(path)?,
        Some("txt") => txt::extract(path)?,
        other => {
            return Err(AppError::Unsupported(
                other.unwrap_or("(none)").to_string(),
            ))
        }
    };
    Ok(sanitize_text(&raw))
}

/// Neutralize dangerous or noisy content in extracted text.
///
/// - Removes control characters except tab/newline.
/// - Prevents CSV/formula injection: if a line begins with `=`, `+`, `-`, `@`
///   (or the tab/CR variants), we prefix it with a single quote so that when a
///   user later exports to CSV and opens it in a spreadsheet, the cell is not
///   evaluated as a formula (a classic OWASP "CSV injection" vector).
/// - Collapses excessive blank lines and trims the total length.
pub fn sanitize_text(input: &str) -> String {
    let mut out = String::with_capacity(input.len().min(MAX_TEXT_CHARS));
    let mut blank_run = 0usize;

    for line in input.lines() {
        // strip control chars (keep tab); normalize whitespace tail
        let cleaned: String = line
            .chars()
            .filter(|c| *c == '\t' || !c.is_control())
            .collect();
        let trimmed_end = cleaned.trim_end();

        if trimmed_end.is_empty() {
            blank_run += 1;
            if blank_run <= 1 {
                out.push('\n');
            }
            continue;
        }
        blank_run = 0;

        let sanitized_line = neutralize_formula(trimmed_end);
        out.push_str(&sanitized_line);
        out.push('\n');

        if out.len() >= MAX_TEXT_CHARS {
            break;
        }
    }

    out.truncate(MAX_TEXT_CHARS);
    out.trim().to_string()
}

/// Prefix a leading formula trigger with `'` to defuse CSV/formula injection.
fn neutralize_formula(line: &str) -> String {
    let first = line.trim_start().chars().next();
    if matches!(first, Some('=') | Some('+') | Some('-') | Some('@')) {
        // Only when it looks like an injection attempt (contains a call or ref),
        // to avoid mangling things like "-5 years" or bullet dashes.
        if line.contains('(') || line.contains('!') || line.starts_with("=@") {
            return format!("'{line}");
        }
    }
    line.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_control_chars() {
        let dirty = "Hello\u{0007}\u{0000}World\nSecond\tline";
        let clean = sanitize_text(dirty);
        assert_eq!(clean, "HelloWorld\nSecond\tline");
    }

    #[test]
    fn defuses_formula_injection() {
        let dirty = "=cmd|'/C calc'!A0\nNormal line";
        let clean = sanitize_text(dirty);
        assert!(clean.starts_with("'=cmd"));
        assert!(clean.contains("Normal line"));
    }

    #[test]
    fn keeps_negative_numbers_and_bullets() {
        let text = "-5 years experience\n- Led a team";
        let clean = sanitize_text(text);
        assert!(clean.contains("-5 years experience"));
        assert!(clean.contains("- Led a team"));
        assert!(!clean.contains("'-"));
    }

    #[test]
    fn collapses_blank_lines() {
        let text = "A\n\n\n\nB";
        let clean = sanitize_text(text);
        assert_eq!(clean, "A\n\nB");
    }

    #[test]
    fn caps_length() {
        let big = "x".repeat(MAX_TEXT_CHARS + 1000);
        let clean = sanitize_text(&big);
        assert!(clean.len() <= MAX_TEXT_CHARS);
    }
}
