//! Heuristic extraction of structured fields from resume text.
//!
//! This is deliberately conservative and dependency-light: regex + keyword
//! matching. It never executes content and treats all text as untrusted. The
//! goal is a good first pass that the user can correct in the UI.

use crate::models::{Candidate, Experience};
use once_cell::sync::Lazy;
use regex::Regex;
use std::collections::BTreeSet;

static EMAIL_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\b[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}\b").unwrap()
});

// International-ish phone matcher: optional +, groups of digits with separators.
static PHONE_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?x)
        (?:\+?\d{1,3}[\s.\-]?)?      # country code
        (?:\(?\d{2,4}\)?[\s.\-]?)    # area
        \d{2,4}[\s.\-]?\d{2,4}       # local
        (?:[\s.\-]?\d{2,4})?         # optional extra
    ").unwrap()
});

static LINKEDIN_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)linkedin\.com/(?:in|pub)/[A-Za-z0-9_\-%]+").unwrap()
});

static YEARS_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)(\d{1,2})\+?\s*(?:years|yrs)\b").unwrap()
});

/// A curated skill vocabulary. Matching is case-insensitive and word-boundary
/// aware. Extend freely — this is a starting set covering common tech roles.
static SKILLS: &[&str] = &[
    "Python", "JavaScript", "TypeScript", "Java", "Kotlin", "Go", "Rust", "C++",
    "C#", "Ruby", "PHP", "Swift", "Scala", "Elixir", "R", "MATLAB", "Perl",
    "SQL", "NoSQL", "PostgreSQL", "MySQL", "SQLite", "MongoDB", "Redis",
    "Cassandra", "Kafka", "RabbitMQ", "Elasticsearch",
    "React", "Vue", "Angular", "Svelte", "Next.js", "Node.js", "Express",
    "Django", "Flask", "FastAPI", "Spring", "Spring Boot", ".NET", "Rails",
    "AWS", "Azure", "GCP", "Google Cloud", "Kubernetes", "Docker", "Terraform",
    "Ansible", "Jenkins", "GitLab CI", "GitHub Actions", "ArgoCD", "Helm",
    "CI/CD", "DevOps", "SRE", "Linux", "Bash", "Git",
    "Machine Learning", "Deep Learning", "TensorFlow", "PyTorch", "Pandas",
    "NumPy", "Scikit-learn", "NLP", "Computer Vision", "Data Science",
    "Security", "IAM", "Threat Modeling", "Penetration Testing", "OWASP",
    "Cryptography", "SIEM", "Incident Response", "Zero Trust",
    "Agile", "Scrum", "Kanban", "Jira", "REST", "GraphQL", "gRPC",
    "Microservices", "Serverless", "HTML", "CSS", "Sass", "Tailwind",
    "Figma", "Product Management", "Leadership",
];

static LANGUAGES: &[&str] = &[
    "English", "Spanish", "French", "German", "Portuguese", "Italian",
    "Dutch", "Russian", "Mandarin", "Chinese", "Cantonese", "Japanese",
    "Korean", "Arabic", "Hindi", "Hungarian", "Polish", "Turkish", "Swedish",
    "Norwegian", "Danish", "Finnish", "Greek", "Czech", "Romanian", "Ukrainian",
    "Hebrew", "Thai", "Vietnamese", "Indonesian",
];

static DEGREE_KEYWORDS: &[&str] = &[
    "bachelor", "master", "phd", "ph.d", "b.sc", "m.sc", "bsc", "msc",
    "b.eng", "m.eng", "beng", "meng", "b.a", "m.a", "mba", "b.tech", "m.tech",
    "diploma", "degree", "university", "college", "institute",
];

static TITLE_KEYWORDS: &[&str] = &[
    "engineer", "developer", "manager", "designer", "analyst", "scientist",
    "architect", "consultant", "lead", "director", "administrator", "specialist",
    "officer", "recruiter", "coordinator", "intern", "president", "founder",
    "head of", "vp", "cto", "ceo", "cfo",
];

static SECTION_SKILLS: &[&str] = &["skills", "technologies", "technical skills", "tech stack"];
static SECTION_LANG: &[&str] = &["languages"];

pub struct Parsed {
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
}

pub fn parse(text: &str) -> Parsed {
    let lines: Vec<&str> = text.lines().map(|l| l.trim()).collect();

    let email = EMAIL_RE.find(text).map(|m| m.as_str().to_string());
    let linkedin = LINKEDIN_RE
        .find(text)
        .map(|m| m.as_str().to_lowercase());
    let phone = find_phone(text);
    let name = guess_name(&lines, email.as_deref());
    let location = guess_location(&lines);
    let skills = find_terms(text, &lines, SKILLS, SECTION_SKILLS);
    let languages = find_terms(text, &lines, LANGUAGES, SECTION_LANG);
    let education = find_education(&lines);
    let last_title = guess_title(&lines);
    let experience_years = guess_years(text);
    let experiences = guess_experiences(&lines);

    Parsed {
        name,
        email,
        phone,
        linkedin,
        location,
        last_title,
        experience_years,
        skills,
        languages,
        education,
        experiences,
    }
}

fn find_phone(text: &str) -> Option<String> {
    for m in PHONE_RE.find_iter(text) {
        let raw = m.as_str().trim();
        let digits = raw.chars().filter(|c| c.is_ascii_digit()).count();
        if (7..=15).contains(&digits) {
            return Some(raw.to_string());
        }
    }
    None
}

fn guess_name(lines: &[&str], email: Option<&str>) -> String {
    // The name is usually the first non-empty line that isn't contact info and
    // looks like 2–4 capitalized words.
    for line in lines.iter().take(8) {
        let l = line.trim();
        if l.is_empty() || l.len() > 48 {
            continue;
        }
        if l.contains('@') || l.chars().any(|c| c.is_ascii_digit()) {
            continue;
        }
        let words: Vec<&str> = l.split_whitespace().collect();
        if (2..=4).contains(&words.len())
            && words
                .iter()
                .all(|w| w.chars().next().map(|c| c.is_uppercase()).unwrap_or(false))
        {
            return l.to_string();
        }
    }
    // Fall back to the local part of the email.
    if let Some(e) = email {
        if let Some(local) = e.split('@').next() {
            let pretty: Vec<String> = local
                .split(|c| c == '.' || c == '_' || c == '-')
                .filter(|s| !s.is_empty())
                .map(capitalize)
                .collect();
            if !pretty.is_empty() {
                return pretty.join(" ");
            }
        }
    }
    "Unknown Candidate".to_string()
}

fn guess_location(lines: &[&str]) -> Option<String> {
    static LOC_RE: Lazy<Regex> = Lazy::new(|| {
        // "City, CC" or "City, Country" patterns.
        Regex::new(r"^[A-Z][A-Za-z .'\-]+,\s*[A-Z][A-Za-z .'\-]{1,}$").unwrap()
    });
    for line in lines.iter().take(15) {
        let l = line.trim();
        if l.len() <= 40 && LOC_RE.is_match(l) {
            return Some(l.to_string());
        }
    }
    None
}

fn guess_title(lines: &[&str]) -> Option<String> {
    for line in lines.iter().take(20) {
        let lower = line.to_lowercase();
        if line.len() <= 60
            && TITLE_KEYWORDS.iter().any(|k| lower.contains(k))
            && !line.contains('@')
        {
            return Some(line.trim().to_string());
        }
    }
    None
}

fn guess_years(text: &str) -> Option<f64> {
    YEARS_RE
        .captures_iter(text)
        .filter_map(|c| c.get(1))
        .filter_map(|m| m.as_str().parse::<f64>().ok())
        .fold(None, |acc: Option<f64>, v| Some(acc.map_or(v, |a| a.max(v))))
}

fn find_terms(
    text: &str,
    lines: &[&str],
    vocab: &[&str],
    section_headers: &[&str],
) -> Vec<String> {
    let mut found: BTreeSet<String> = BTreeSet::new();
    let lower = text.to_lowercase();

    for term in vocab {
        if contains_term(&lower, &term.to_lowercase()) {
            found.insert((*term).to_string());
        }
    }

    // Also mine explicit "Skills:" / "Languages:" sections for comma lists.
    for (i, line) in lines.iter().enumerate() {
        let ll = line.to_lowercase();
        if section_headers.iter().any(|h| ll.starts_with(h)) {
            let mut chunk = line.splitn(2, ':').nth(1).unwrap_or("").to_string();
            if chunk.trim().is_empty() && i + 1 < lines.len() {
                chunk = lines[i + 1].to_string();
            }
            for part in chunk.split(|c| c == ',' || c == '·' || c == '|' || c == '•') {
                let cand = part.trim();
                if (2..=30).contains(&cand.len())
                    && !cand.chars().all(|c| c.is_ascii_punctuation())
                {
                    found.insert(cand.to_string());
                }
            }
        }
    }

    found.into_iter().collect()
}

/// Word-boundary-ish containment that also handles terms with symbols
/// (`c++`, `.net`, `ci/cd`, `node.js`).
fn contains_term(haystack: &str, term: &str) -> bool {
    let has_symbol = term.chars().any(|c| !c.is_ascii_alphanumeric() && c != ' ');
    if has_symbol {
        return haystack.contains(term);
    }
    let bytes = haystack.as_bytes();
    let mut start = 0;
    while let Some(pos) = haystack[start..].find(term) {
        let abs = start + pos;
        let before_ok = abs == 0 || !is_word_byte(bytes[abs - 1]);
        let after = abs + term.len();
        let after_ok = after >= bytes.len() || !is_word_byte(bytes[after]);
        if before_ok && after_ok {
            return true;
        }
        start = abs + 1;
        if start >= haystack.len() {
            break;
        }
    }
    false
}

fn is_word_byte(b: u8) -> bool {
    b.is_ascii_alphanumeric() || b == b'+' || b == b'#' || b == b'.'
}

fn find_education(lines: &[&str]) -> Vec<String> {
    let mut out = Vec::new();
    for line in lines {
        let lower = line.to_lowercase();
        if DEGREE_KEYWORDS.iter().any(|k| lower.contains(k))
            && line.len() >= 6
            && line.len() <= 120
        {
            let entry = line.trim().to_string();
            if !out.contains(&entry) {
                out.push(entry);
            }
        }
        if out.len() >= 6 {
            break;
        }
    }
    out
}

fn guess_experiences(lines: &[&str]) -> Vec<Experience> {
    // Look for lines like "Senior Engineer, Acme Corp (2019 - 2023)".
    static EXP_RE: Lazy<Regex> = Lazy::new(|| {
        Regex::new(
            r"(?i)(.{3,60}?)\s*[,@\-–|]\s*(.{2,50}?)\s*[\(\-–]?\s*((?:19|20)\d{2})\s*[\-–to]+\s*((?:19|20)\d{2}|present|current)",
        )
        .unwrap()
    });
    let mut out = Vec::new();
    for line in lines {
        if let Some(c) = EXP_RE.captures(line) {
            out.push(Experience {
                title: c.get(1).map(|m| m.as_str().trim().to_string()).unwrap_or_default(),
                employer: c.get(2).map(|m| m.as_str().trim().to_string()).unwrap_or_default(),
                period: format!(
                    "{} - {}",
                    c.get(3).map(|m| m.as_str()).unwrap_or(""),
                    c.get(4).map(|m| m.as_str()).unwrap_or("")
                ),
                description: String::new(),
            });
        }
        if out.len() >= 12 {
            break;
        }
    }
    out
}

fn capitalize(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        None => String::new(),
    }
}

/// Expose the skill vocabulary to other modules (job requirement extraction).
pub fn skill_vocab() -> &'static [&'static str] {
    SKILLS
}

/// Public wrapper around the word-boundary term matcher.
pub fn text_contains_term(haystack_lower: &str, term_lower: &str) -> bool {
    contains_term(haystack_lower, term_lower)
}

/// Apply parsed fields onto a candidate record.
pub fn apply_to_candidate(c: &mut Candidate, parsed: Parsed) {
    c.name = parsed.name;
    c.email = parsed.email;
    c.phone = parsed.phone;
    c.linkedin = parsed.linkedin;
    c.location = parsed.location;
    c.last_title = parsed.last_title;
    c.experience_years = parsed.experience_years;
    c.skills = parsed.skills;
    c.languages = parsed.languages;
    c.education = parsed.education;
    c.experiences = parsed.experiences;
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = "Ada Kovacs\nBudapest, Hungary\nada.kovacs@example.com | +36 30 111 2233\nlinkedin.com/in/adakovacs\n\nSenior DevOps Engineer\n\nSummary\n8 years of experience building platforms.\n\nSkills: Kubernetes, AWS, Terraform, Go, CI/CD\n\nLanguages: English, Hungarian\n\nEducation\nBSc Computer Science, ELTE University\n\nExperience\nSenior DevOps Engineer, Acme Corp (2019 - present)\n";

    #[test]
    fn extracts_contact() {
        let p = parse(SAMPLE);
        assert_eq!(p.email.as_deref(), Some("ada.kovacs@example.com"));
        assert!(p.phone.is_some());
        assert_eq!(p.linkedin.as_deref(), Some("linkedin.com/in/adakovacs"));
    }

    #[test]
    fn extracts_name_and_location() {
        let p = parse(SAMPLE);
        assert_eq!(p.name, "Ada Kovacs");
        assert_eq!(p.location.as_deref(), Some("Budapest, Hungary"));
    }

    #[test]
    fn extracts_skills_and_years() {
        let p = parse(SAMPLE);
        assert!(p.skills.iter().any(|s| s == "Kubernetes"));
        assert!(p.skills.iter().any(|s| s == "AWS"));
        assert!(p.skills.iter().any(|s| s == "CI/CD"));
        assert_eq!(p.experience_years, Some(8.0));
    }

    #[test]
    fn extracts_languages_and_education() {
        let p = parse(SAMPLE);
        assert!(p.languages.iter().any(|l| l == "English"));
        assert!(p.education.iter().any(|e| e.contains("BSc")));
    }

    #[test]
    fn handles_empty() {
        let p = parse("");
        assert_eq!(p.name, "Unknown Candidate");
        assert!(p.email.is_none());
    }
}
