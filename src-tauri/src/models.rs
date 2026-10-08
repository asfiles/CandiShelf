use serde::{Deserialize, Serialize};

/// A single work-experience entry parsed from a resume.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Experience {
    pub employer: String,
    pub title: String,
    pub period: String,
    pub description: String,
}

/// Full candidate record as stored and returned to the UI.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Candidate {
    pub id: i64,
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub linkedin: Option<String>,
    pub location: Option<String>,
    pub last_title: Option<String>,
    pub experience_years: Option<f64>,
    pub skills: Vec<String>,
    pub languages: Vec<String>,
    pub education: Vec<String>,
    pub experiences: Vec<Experience>,
    pub source_path: String,
    pub stored_path: Option<String>,
    pub full_text: String,
    pub created_at: String,
    pub updated_at: String,
    pub duplicate_of: Vec<i64>,
    pub in_shortlist: bool,
}

/// Lightweight candidate projection for lists and search results. Carries every
/// field the structured filters need, so a single predicate can be shared by
/// the flat list and every search channel.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CandidateSummary {
    pub id: i64,
    pub name: String,
    pub email: Option<String>,
    pub location: Option<String>,
    pub last_title: Option<String>,
    pub experience_years: Option<f64>,
    pub skills: Vec<String>,
    pub languages: Vec<String>,
    pub in_shortlist: bool,
    pub has_duplicates: bool,
}

/// Structured post-filters applied on top of semantic ranking. Field names are
/// camel/snake as sent by the UI; every field is optional so older clients keep
/// working (`#[serde(default)]`).
#[derive(Debug, Clone, Deserialize, Default)]
#[serde(default)]
pub struct SearchFilters {
    pub location: Option<String>,
    pub min_experience: Option<f64>,
    pub max_experience: Option<f64>,
    pub last_title: Option<String>,
    /// Candidate must have *all* of these skills.
    #[serde(deserialize_with = "deserialize_null_default")]
    pub skills_all: Vec<String>,
    /// Candidate must have *any* of these skills.
    #[serde(deserialize_with = "deserialize_null_default")]
    pub skills_any: Vec<String>,
    /// Candidate must have *none* of these skills.
    #[serde(deserialize_with = "deserialize_null_default")]
    pub skills_exclude: Vec<String>,
    /// Candidate must speak *all* of these languages.
    #[serde(deserialize_with = "deserialize_null_default")]
    pub languages: Vec<String>,
    pub in_shortlist_only: bool,
    /// Collapse duplicate groups (shared email/phone/LinkedIn) to one row.
    pub exclude_duplicates: bool,
}

/// Accept both a missing and an explicit `null` for list fields, defaulting to
/// empty. `#[serde(default)]` alone rejects `null`.
fn deserialize_null_default<'de, D, T>(d: D) -> Result<T, D::Error>
where
    D: serde::Deserializer<'de>,
    T: Default + Deserialize<'de>,
{
    Ok(Option::<T>::deserialize(d)?.unwrap_or_default())
}

#[derive(Debug, Clone, Serialize)]
pub struct SearchResult {
    pub candidate: CandidateSummary,
    pub score: f64,
    /// How this candidate matched: one of `email`, `phone`, `linkedin`, `name`,
    /// `semantic`. The UI turns it into a localized label.
    pub match_kind: String,
    pub snippet: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct JobRequirement {
    pub label: String,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct JobMatchResult {
    pub candidate: CandidateSummary,
    pub score: f64,
    pub matched: Vec<String>,
    pub missing: Vec<String>,
    pub snippet: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct JobMatchResponse {
    pub requirements: Vec<JobRequirement>,
    pub results: Vec<JobMatchResult>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ImportError {
    pub file: String,
    pub error: String,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct ImportSummary {
    pub found: usize,
    pub processed: usize,
    pub failed: Vec<ImportError>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ImportProgress {
    pub found: usize,
    pub processed: usize,
    pub current_file: String,
}

/// One file that makes up a model, with the URL it is normally fetched from.
/// Shown in the UI so a model can also be installed by hand.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelFileInfo {
    pub name: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    /// One-line "what's the difference" hint for the model chooser.
    pub short_desc: String,
    pub languages: String,
    pub size_bytes: u64,
    pub downloaded: bool,
    pub recommended: bool,
    /// Whether this model is the currently active embedding model.
    pub active: bool,
    /// Primary download URL (the weights), shown in the UI.
    pub url: String,
    /// Absolute folder the model's files must live in. Lets the user install a
    /// model manually (place the files here) instead of downloading through the
    /// app; it is also where auto-downloads are written.
    pub dir: String,
    /// Every file that makes up the model, so a manual install is unambiguous.
    pub files: Vec<ModelFileInfo>,
}

/// Byte-level progress for a model download, streamed to the UI.
#[derive(Debug, Clone, Serialize)]
pub struct ModelDownloadProgress {
    pub model_id: String,
    pub file_name: String,
    pub file_index: usize,
    pub file_count: usize,
    pub downloaded: u64,
    pub total: u64,
    pub done: bool,
}

/// Progress of re-embedding the existing candidate base after a model change.
#[derive(Debug, Clone, Serialize)]
pub struct ReindexProgress {
    pub processed: usize,
    pub total: usize,
    pub done: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub data_dir: String,
    pub version: String,
    pub active_model: Option<String>,
    pub copy_originals: bool,
}

/// Static application metadata shown on the About screen. `version` comes from
/// Cargo (synced to the Git tag at release time), so it always matches the tag.
#[derive(Debug, Clone, Serialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    /// Git tag this build corresponds to, e.g. "v0.1.0".
    pub tag: String,
    pub author: String,
    pub author_url: String,
    pub homepage: String,
    pub license: String,
}
