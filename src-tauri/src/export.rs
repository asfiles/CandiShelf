//! Shortlist CSV export with formula-injection-safe cell encoding.

use crate::db::Db;
use crate::error::{AppError, AppResult};
use std::path::{Path, PathBuf};

/// Write the current shortlist to a CSV file in the given directory.
/// Returns the path written.
pub fn export_shortlist(db: &Db, out_dir: &Path) -> AppResult<PathBuf> {
    let candidates = db.shortlisted()?;
    std::fs::create_dir_all(out_dir)?;
    let path = out_dir.join(format!(
        "shortlist-{}.csv",
        chrono::Utc::now().format("%Y%m%d-%H%M%S")
    ));

    let mut wtr = csv::Writer::from_path(&path)
        .map_err(|e| AppError::Io(e.to_string()))?;

    wtr.write_record([
        "Name",
        "Email",
        "Phone",
        "LinkedIn",
        "Location",
        "Last title",
        "Experience (years)",
        "Skills",
        "Languages",
        "Source file",
    ])
    .map_err(|e| AppError::Io(e.to_string()))?;

    for c in candidates {
        wtr.write_record([
            csv_safe(&c.name),
            csv_safe(&c.email.unwrap_or_default()),
            csv_safe(&c.phone.unwrap_or_default()),
            csv_safe(&c.linkedin.unwrap_or_default()),
            csv_safe(&c.location.unwrap_or_default()),
            csv_safe(&c.last_title.unwrap_or_default()),
            c.experience_years
                .map(|y| y.to_string())
                .unwrap_or_default(),
            csv_safe(&c.skills.join("; ")),
            csv_safe(&c.languages.join("; ")),
            csv_safe(&c.source_path),
        ])
        .map_err(|e| AppError::Io(e.to_string()))?;
    }

    wtr.flush().map_err(|e| AppError::Io(e.to_string()))?;
    Ok(path)
}

/// Defuse CSV/formula injection: prefix a leading formula trigger with `'`.
/// The `csv` crate already handles quoting/escaping of delimiters and quotes.
fn csv_safe(value: &str) -> String {
    let trimmed = value.trim_start();
    if matches!(
        trimmed.chars().next(),
        Some('=') | Some('+') | Some('-') | Some('@') | Some('\t') | Some('\r')
    ) {
        format!("'{value}")
    } else {
        value.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn neutralizes_formula_cells() {
        assert_eq!(csv_safe("=SUM(A1:A9)"), "'=SUM(A1:A9)");
        assert_eq!(csv_safe("+1-800"), "'+1-800");
        assert_eq!(csv_safe("@handle"), "'@handle");
    }

    #[test]
    fn leaves_normal_cells() {
        assert_eq!(csv_safe("Ada Kovács"), "Ada Kovács");
        assert_eq!(csv_safe("Budapest"), "Budapest");
    }
}
