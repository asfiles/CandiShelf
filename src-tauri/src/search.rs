//! Hybrid search (exact contact / name + semantic) and job matching.
//!
//! Search runs in tiers, highest priority first:
//!   0. exact contact identity — email / phone / LinkedIn (normalized lookup)
//!   1. name substring — only for name-like queries (any token order)
//!   2. semantic — embedding cosine similarity, the fallback for free text
//!
//! A tier only runs when the tiers above returned nothing, so an exact contact
//! query never gets buried under "semantically similar" candidates and no
//! embedding is computed when a literal hit already answered the query.
//! Structured [`SearchFilters`] are applied to every tier.

use crate::ai;
use crate::db::{Db, IdentityColumn};
use crate::error::AppResult;
use crate::filters;
use crate::models::{
    JobMatchResponse, JobMatchResult, JobRequirement, SearchFilters, SearchResult,
};
use std::collections::{HashMap, HashSet};
use std::path::Path;

const SNIPPET_LEN: usize = 160;
const MAX_SEMANTIC: usize = 50;

/// Rank candidates for `query`, applying `filters` to every channel.
pub fn hybrid_search(
    db: &Db,
    data_dir: &Path,
    active_model: Option<&str>,
    query: &str,
    filters: &SearchFilters,
) -> AppResult<Vec<SearchResult>> {
    let q = query.trim();
    if q.is_empty() {
        return Ok(Vec::new());
    }

    // Duplicate groups are computed once and reused for both the
    // `exclude_duplicates` filter and the `has_duplicates` flag.
    let groups = db.duplicate_groups()?;
    let terms: Vec<String> = q.split_whitespace().map(|s| s.to_lowercase()).collect();
    let mut seen: HashSet<i64> = HashSet::new();
    let mut out: Vec<SearchResult> = Vec::new();

    // Tier 0 — exact contact identity. An address query is an exact lookup, so
    // when one is recognized we never fall back to semantic search.
    if let Some((col, value)) = detect_identity(q) {
        for s in db.summaries_by_identity(col, &value)? {
            push_hit(
                db,
                &groups,
                &mut out,
                &mut seen,
                s,
                filters,
                col.kind(),
                1.0,
                &terms,
            )?;
        }
        return Ok(out);
    }

    // Tier 1 — name match (only when the query looks like a person's name).
    if looks_like_name(q) {
        for s in db.list_summaries(filters)? {
            if !name_matches(&s.name, &terms) {
                continue;
            }
            push_hit(
                db, &groups, &mut out, &mut seen, s, filters, "name", 0.9, &terms,
            )?;
        }
    }

    // Tier 2 — semantic fallback.
    if out.is_empty() {
        let query_vec = ai::embed(data_dir, active_model, q)?;
        let mut scored: Vec<(i64, f32)> = db
            .all_embeddings()?
            .into_iter()
            .map(|(id, emb)| (id, ai::cosine(&query_vec, &emb)))
            .collect();
        scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        for (id, sim) in scored.into_iter().take(MAX_SEMANTIC) {
            if sim <= 0.0 {
                continue;
            }
            let s = db.summary_by_id_raw(id)?;
            push_hit(
                db, &groups, &mut out, &mut seen, s, filters, "semantic", sim as f64, &terms,
            )?;
        }
    }

    Ok(out)
}

/// Apply filters, dedupe by id, set the duplicate flag and append the result.
#[allow(clippy::too_many_arguments)]
fn push_hit(
    db: &Db,
    groups: &crate::db::DuplicateGroups,
    out: &mut Vec<SearchResult>,
    seen: &mut HashSet<i64>,
    mut s: crate::models::CandidateSummary,
    filters: &SearchFilters,
    match_kind: &str,
    score: f64,
    terms: &[String],
) -> AppResult<()> {
    if !filters::matches(&s, filters, Some(&groups.representative)) {
        return Ok(());
    }
    if !seen.insert(s.id) {
        return Ok(());
    }
    s.has_duplicates = groups.duplicated.contains(&s.id);
    let snippet = make_snippet(&db.candidate_text(s.id)?, terms);
    out.push(SearchResult {
        candidate: s,
        score,
        match_kind: match_kind.to_string(),
        snippet,
    });
    Ok(())
}

/// Recognize an exact-contact query and normalize it the same way stored
/// contacts are normalized, so `+1 (555) …` matches `555…` etc.
fn detect_identity(q: &str) -> Option<(IdentityColumn, String)> {
    if let Some(email) = crate::db::norm_email(Some(q)) {
        return Some((IdentityColumn::Email, email));
    }
    if !q.chars().any(|c| c.is_alphabetic()) {
        if let Some(phone) = crate::db::norm_phone(Some(q)) {
            return Some((IdentityColumn::Phone, phone));
        }
    }
    let lower = q.to_lowercase();
    if lower.contains("linkedin.com") || lower.contains("/in/") {
        if let Some(link) = crate::db::norm_linkedin(Some(q)) {
            return Some((IdentityColumn::Linkedin, link));
        }
    }
    None
}

/// A short, alphabetic, non-skill query that plausibly names a person.
fn looks_like_name(q: &str) -> bool {
    if q.contains('@') || q.chars().any(|c| c.is_ascii_digit()) {
        return false;
    }
    let tokens: Vec<&str> = q.split_whitespace().collect();
    if tokens.is_empty() || tokens.len() > 4 {
        return false;
    }
    tokens.iter().all(|t| {
        t.chars()
            .all(|c| c.is_alphabetic() || c == '-' || c == '\'')
            && !crate::parser::skill_vocab()
                .iter()
                .any(|s| s.eq_ignore_ascii_case(t))
    })
}

/// Every query token must appear somewhere in the name (any order), so
/// "Ivanov Ivan" also matches "Ivan Ivanov".
fn name_matches(name: &str, terms: &[String]) -> bool {
    let lower = name.to_lowercase();
    terms.iter().all(|t| lower.contains(t.as_str()))
}

/// Match candidates to a pasted job description, ranking by embedding
/// similarity and reporting matched/missing detected requirements.
pub fn match_job(
    db: &Db,
    data_dir: &Path,
    active_model: Option<&str>,
    job_text: &str,
) -> AppResult<JobMatchResponse> {
    let requirements = extract_requirements(job_text);
    let req_labels: Vec<String> = requirements.iter().map(|r| r.label.clone()).collect();
    let job_embedding = ai::embed(data_dir, active_model, job_text)?;

    let mut results = Vec::new();
    let summaries = db.list_summaries(&SearchFilters::default())?;
    for s in summaries {
        let candidate = db.get_candidate(s.id)?;
        let skill_set: Vec<String> =
            candidate.skills.iter().map(|s| s.to_lowercase()).collect();
        let hay = format!(
            "{} {}",
            candidate.full_text.to_lowercase(),
            skill_set.join(" ")
        );

        let matched: Vec<String> = req_labels
            .iter()
            .filter(|r| {
                let rl = r.to_lowercase();
                skill_set.iter().any(|s| s == &rl) || hay.contains(&rl)
            })
            .cloned()
            .collect();
        let missing: Vec<String> = req_labels
            .iter()
            .filter(|r| !matched.contains(r))
            .cloned()
            .collect();

        // Blend requirement coverage with overall semantic similarity so
        // candidates are ranked sensibly even when requirement lists are short.
        let coverage = if req_labels.is_empty() {
            0.0
        } else {
            matched.len() as f64 / req_labels.len() as f64
        };
        let emb = db.get_embedding(s.id)?;
        let sim = ai::cosine(&job_embedding, &emb) as f64;
        let score = 0.5 * coverage + 0.5 * sim.max(0.0);

        results.push(JobMatchResult {
            snippet: make_snippet(&candidate.full_text, &matched),
            candidate: s,
            score,
            matched,
            missing,
        });
    }
    results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));

    Ok(JobMatchResponse {
        requirements,
        results,
    })
}

/// Extract likely requirements (skills) from a job description by matching
/// against the known vocabulary used during resume parsing.
fn extract_requirements(job_text: &str) -> Vec<JobRequirement> {
    let lower = job_text.to_lowercase();
    let mut seen: HashMap<String, ()> = HashMap::new();
    let mut out = Vec::new();

    for skill in crate::parser::skill_vocab() {
        if crate::parser::text_contains_term(&lower, &skill.to_lowercase())
            && !seen.contains_key(*skill)
        {
            seen.insert((*skill).to_string(), ());
            out.push(JobRequirement {
                label: (*skill).to_string(),
                kind: "skill".to_string(),
            });
        }
    }
    out
}

/// Build a short snippet around the first matching term.
fn make_snippet(text: &str, terms: &[String]) -> String {
    if text.is_empty() {
        return String::new();
    }
    let lower = text.to_lowercase();
    let mut best: Option<usize> = None;
    for t in terms {
        if let Some(pos) = lower.find(t.as_str()) {
            best = Some(best.map_or(pos, |b| b.min(pos)));
        }
    }
    let start = best.map(|p| p.saturating_sub(50)).unwrap_or(0);
    let start = floor_char_boundary(text, start);
    let end = floor_char_boundary(text, (start + SNIPPET_LEN).min(text.len()));
    let mut snippet = text[start..end].replace('\n', " ").trim().to_string();
    if start > 0 {
        snippet = format!("…{snippet}");
    }
    if end < text.len() {
        snippet.push('…');
    }
    snippet
}

fn floor_char_boundary(s: &str, mut idx: usize) -> usize {
    if idx >= s.len() {
        return s.len();
    }
    while idx > 0 && !s.is_char_boundary(idx) {
        idx -= 1;
    }
    idx
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::Candidate;
    use std::path::PathBuf;

    // Tests run without the candle feature, so `ai::embed` falls back to the
    // deterministic lexical embedder — enough to validate ranking wiring.
    fn setup() -> Db {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        let db = Db { conn };
        db.init_schema_for_test();
        for (name, title, skills, text) in [
            (
                "Ada",
                "DevOps Engineer",
                vec!["Kubernetes", "AWS", "Terraform"],
                "DevOps engineer with Kubernetes AWS Terraform in fintech",
            ),
            (
                "Bruno",
                "Security Engineer",
                vec!["AWS", "IAM", "Python"],
                "Security engineer cloud infrastructure AWS IAM Python",
            ),
            (
                "Chen",
                "Chef",
                vec!["Cooking"],
                "Head chef with catering experience",
            ),
        ] {
            let c = Candidate {
                name: name.into(),
                last_title: Some(title.into()),
                skills: skills.into_iter().map(String::from).collect(),
                full_text: text.into(),
                email: Some(format!("{name}@ex.com")),
                phone: if name == "Ada" {
                    Some("+1 (555) 111-2233".into())
                } else {
                    None
                },
                source_path: format!("/{name}.pdf"),
                ..Default::default()
            };
            let emb = ai::embed_lexical(&format!("{} {}", c.full_text, c.skills.join(" ")));
            db.insert_candidate(&c, &emb, "lexical-fallback").unwrap();
        }
        db
    }

    fn search(db: &Db, q: &str) -> Vec<SearchResult> {
        hybrid_search(db, &PathBuf::from("."), None, q, &SearchFilters::default()).unwrap()
    }

    #[test]
    fn semantic_search_returns_results() {
        let db = setup();
        let r = search(&db, "Kubernetes AWS");
        assert!(!r.is_empty());
        assert!(r.iter().all(|x| x.match_kind == "semantic"));
    }

    #[test]
    fn finds_candidate_by_email_exactly() {
        let db = setup();
        let r = search(&db, "ADA@EX.COM");
        assert_eq!(r.len(), 1);
        assert_eq!(r[0].candidate.name, "Ada");
        assert_eq!(r[0].match_kind, "email");
    }

    #[test]
    fn finds_candidate_by_phone_ignoring_format() {
        let db = setup();
        let r = search(&db, "+1 (555) 111-2233");
        assert_eq!(r.len(), 1);
        assert_eq!(r[0].candidate.name, "Ada");
        assert_eq!(r[0].match_kind, "phone");
    }

    #[test]
    fn finds_candidate_by_name() {
        let db = setup();
        let r = search(&db, "Bruno");
        assert_eq!(r.len(), 1);
        assert_eq!(r[0].candidate.name, "Bruno");
        assert_eq!(r[0].match_kind, "name");
    }

    #[test]
    fn filters_apply_to_literal_hits() {
        let db = setup();
        let f = SearchFilters {
            skills_exclude: vec!["Kubernetes".into()],
            ..Default::default()
        };
        let r = hybrid_search(&db, &PathBuf::from("."), None, "ada@ex.com", &f).unwrap();
        assert!(r.is_empty());
    }

    #[test]
    fn job_match_reports_matched_and_missing() {
        let db = setup();
        let resp = match_job(
            &db,
            &PathBuf::from("."),
            None,
            "Need AWS, Kubernetes, Terraform, Python",
        )
        .unwrap();
        assert!(resp.requirements.iter().any(|r| r.label == "Kubernetes"));
        let bruno = resp
            .results
            .iter()
            .find(|r| r.candidate.name == "Bruno")
            .unwrap();
        assert!(bruno.matched.contains(&"AWS".to_string()));
        assert!(bruno.missing.contains(&"Kubernetes".to_string()));
    }
}
