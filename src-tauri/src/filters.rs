//! Structured post-filters, shared by the candidate list and every search
//! channel.
//!
//! Filters are *hard* predicates: they never influence semantic ranking, they
//! only decide whether a candidate is allowed into the result set. Keeping them
//! in one function guarantees the flat list (empty query) and literal/semantic
//! search agree on what "matches" means.

use crate::models::{CandidateSummary, SearchFilters};
use std::collections::{HashMap, HashSet};

/// Maps each candidate id to the id of its duplicate-group representative
/// (itself when it belongs to no group). Only built when duplicate collapsing
/// is requested.
pub type Representatives = HashMap<i64, i64>;

fn norm(s: &str) -> String {
    s.trim().to_lowercase()
}

fn has_all(cand: &[String], wanted: &[String]) -> bool {
    let set: HashSet<String> = cand.iter().map(|s| norm(s)).collect();
    wanted
        .iter()
        .filter(|w| !w.trim().is_empty())
        .all(|w| set.contains(&norm(w)))
}

fn has_any(cand: &[String], wanted: &[String]) -> bool {
    let set: HashSet<String> = cand.iter().map(|s| norm(s)).collect();
    wanted
        .iter()
        .filter(|w| !w.trim().is_empty())
        .any(|w| set.contains(&norm(w)))
}

fn contains_ci(hay: Option<&str>, needle: &str) -> bool {
    hay.map(|v| v.to_lowercase().contains(&needle.to_lowercase()))
        .unwrap_or(false)
}

/// True when `s` passes every active filter.
pub fn matches(s: &CandidateSummary, f: &SearchFilters, reps: Option<&Representatives>) -> bool {
    if let Some(loc) = f
        .location
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
    {
        if !contains_ci(s.location.as_deref(), loc) {
            return false;
        }
    }

    if let Some(min) = f.min_experience {
        if s.experience_years.unwrap_or(0.0) < min {
            return false;
        }
    }
    if let Some(max) = f.max_experience {
        if s.experience_years.unwrap_or(0.0) > max {
            return false;
        }
    }

    if let Some(title) = f
        .last_title
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
    {
        if !contains_ci(s.last_title.as_deref(), title) {
            return false;
        }
    }

    if !f.skills_all.is_empty() && !has_all(&s.skills, &f.skills_all) {
        return false;
    }
    if !f.skills_any.is_empty() && !has_any(&s.skills, &f.skills_any) {
        return false;
    }
    if !f.skills_exclude.is_empty() && has_any(&s.skills, &f.skills_exclude) {
        return false;
    }
    if !f.languages.is_empty() && !has_all(&s.languages, &f.languages) {
        return false;
    }

    if f.in_shortlist_only && !s.in_shortlist {
        return false;
    }

    if f.exclude_duplicates {
        if let Some(map) = reps {
            if map.get(&s.id).map_or(false, |rep| *rep != s.id) {
                return false;
            }
        }
    }

    true
}

#[cfg(test)]
mod tests {
    use super::*;

    fn summary() -> CandidateSummary {
        CandidateSummary {
            id: 1,
            name: "Ada Kovács".into(),
            email: Some("ada@example.com".into()),
            location: Some("Budapest, HU".into()),
            last_title: Some("Senior DevOps Engineer".into()),
            experience_years: Some(8.0),
            skills: vec!["Kubernetes".into(), "AWS".into(), "Terraform".into()],
            languages: vec!["English".into(), "Hungarian".into()],
            in_shortlist: true,
            has_duplicates: false,
        }
    }

    #[test]
    fn empty_filters_match_everything() {
        assert!(matches(&summary(), &SearchFilters::default(), None));
    }

    #[test]
    fn experience_range_is_inclusive() {
        let s = summary();
        let within = SearchFilters {
            min_experience: Some(5.0),
            max_experience: Some(10.0),
            ..Default::default()
        };
        assert!(matches(&s, &within, None));
        let too_high = SearchFilters {
            max_experience: Some(5.0),
            ..Default::default()
        };
        assert!(!matches(&s, &too_high, None));
    }

    #[test]
    fn skills_all_any_and_exclude() {
        let s = summary();
        let all = SearchFilters {
            skills_all: vec!["aws".into(), "KUBERNETES".into()],
            ..Default::default()
        };
        assert!(matches(&s, &all, None));

        let missing = SearchFilters {
            skills_all: vec!["aws".into(), "Go".into()],
            ..Default::default()
        };
        assert!(!matches(&s, &missing, None));

        let excluded = SearchFilters {
            skills_exclude: vec!["terraform".into()],
            ..Default::default()
        };
        assert!(!matches(&s, &excluded, None));

        let any = SearchFilters {
            skills_any: vec!["Go".into(), "terraform".into()],
            ..Default::default()
        };
        assert!(matches(&s, &any, None));
    }

    #[test]
    fn languages_and_shortlist() {
        let s = summary();
        let langs = SearchFilters {
            languages: vec!["english".into(), "Hungarian".into()],
            ..Default::default()
        };
        assert!(matches(&s, &langs, None));

        let mut not_shortlisted = summary();
        not_shortlisted.in_shortlist = false;
        let only_short = SearchFilters {
            in_shortlist_only: true,
            ..Default::default()
        };
        assert!(!matches(&not_shortlisted, &only_short, None));
    }

    #[test]
    fn exclude_duplicates_keeps_only_representative() {
        let s = summary();
        let f = SearchFilters {
            exclude_duplicates: true,
            ..Default::default()
        };
        let mut reps = Representatives::new();
        reps.insert(1, 1);
        assert!(matches(&s, &f, Some(&reps)));

        let mut reps = Representatives::new();
        reps.insert(1, 2); // candidate 1 folds into representative 2
        assert!(!matches(&s, &f, Some(&reps)));
    }
}
