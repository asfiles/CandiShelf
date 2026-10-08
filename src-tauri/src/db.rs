//! SQLite persistence for candidates + embeddings.
//!
//! Storage layout (per data dir):
//!   candishelf.db      — candidates + embeddings
//!   originals/         — optional copies of source resumes
//!   models/            — downloaded AI models
//!
//! All queries are parameterized (no string interpolation) to eliminate SQL
//! injection. Candidate identity de-duplication is computed from normalized
//! email / phone / LinkedIn.

use crate::ai;
use crate::error::{AppError, AppResult};
use crate::filters;
use crate::models::{Candidate, CandidateSummary, Experience, SearchFilters};
use rusqlite::{params, Connection, OptionalExtension, Row};
use std::collections::{HashMap, HashSet};
use std::path::Path;

/// Column list for the lightweight candidate projection. Must stay in the same
/// order as `summary_from_row` reads it.
const SUMMARY_COLS: &str =
    "id, name, email, location, last_title, experience_years, skills, in_shortlist, languages";

/// A normalized identity column used for exact contact lookup.
#[derive(Debug, Clone, Copy)]
pub enum IdentityColumn {
    Email,
    Phone,
    Linkedin,
}

impl IdentityColumn {
    fn column(self) -> &'static str {
        match self {
            IdentityColumn::Email => "email_norm",
            IdentityColumn::Phone => "phone_norm",
            IdentityColumn::Linkedin => "linkedin_norm",
        }
    }

    /// Stable `match_kind` label returned to the UI.
    pub fn kind(self) -> &'static str {
        match self {
            IdentityColumn::Email => "email",
            IdentityColumn::Phone => "phone",
            IdentityColumn::Linkedin => "linkedin",
        }
    }
}

/// Duplicate-grouping result: each id's representative id, plus the set of ids
/// that share an identity with at least one other candidate.
pub struct DuplicateGroups {
    pub representative: HashMap<i64, i64>,
    pub duplicated: HashSet<i64>,
}

pub struct Db {
    pub conn: Connection,
}

impl Db {
    pub fn open(db_path: &Path) -> AppResult<Self> {
        let conn = Connection::open(db_path)?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        conn.pragma_update(None, "synchronous", "NORMAL")?;
        let db = Db { conn };
        db.init_schema()?;
        Ok(db)
    }

    fn init_schema(&self) -> AppResult<()> {
        self.conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS candidates (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                name             TEXT NOT NULL DEFAULT '',
                email            TEXT,
                phone            TEXT,
                linkedin         TEXT,
                email_norm       TEXT,
                phone_norm       TEXT,
                linkedin_norm    TEXT,
                location         TEXT,
                last_title       TEXT,
                experience_years REAL,
                skills           TEXT NOT NULL DEFAULT '[]',
                languages        TEXT NOT NULL DEFAULT '[]',
                education        TEXT NOT NULL DEFAULT '[]',
                experiences      TEXT NOT NULL DEFAULT '[]',
                source_path      TEXT NOT NULL DEFAULT '',
                stored_path      TEXT,
                full_text        TEXT NOT NULL DEFAULT '',
                embedding        BLOB,
                embedding_model  TEXT,
                in_shortlist     INTEGER NOT NULL DEFAULT 0,
                created_at       TEXT NOT NULL,
                updated_at       TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_email_norm ON candidates(email_norm);
            CREATE INDEX IF NOT EXISTS idx_phone_norm ON candidates(phone_norm);
            CREATE INDEX IF NOT EXISTS idx_linkedin_norm ON candidates(linkedin_norm);
            "#,
        )?;
        Ok(())
    }

    /// Test-only helper to create the schema on an in-memory connection.
    #[cfg(test)]
    pub fn init_schema_for_test(&self) {
        self.init_schema().unwrap();
    }

    pub fn insert_candidate(
        &self,
        c: &Candidate,
        embedding: &[f32],
        embedding_model: &str,
    ) -> AppResult<i64> {
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            r#"INSERT INTO candidates
               (name, email, phone, linkedin, email_norm, phone_norm, linkedin_norm,
                location, last_title, experience_years, skills, languages, education,
                experiences, source_path, stored_path, full_text, embedding,
                embedding_model, in_shortlist, created_at, updated_at)
               VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22)"#,
            params![
                c.name,
                c.email,
                c.phone,
                c.linkedin,
                norm_email(c.email.as_deref()),
                norm_phone(c.phone.as_deref()),
                norm_linkedin(c.linkedin.as_deref()),
                c.location,
                c.last_title,
                c.experience_years,
                json(&c.skills),
                json(&c.languages),
                json(&c.education),
                json(&c.experiences),
                c.source_path,
                c.stored_path,
                c.full_text,
                ai::embedding_to_bytes(embedding),
                embedding_model,
                c.in_shortlist as i32,
                now,
                now,
            ],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn update_candidate(
        &self,
        c: &Candidate,
        embedding: &[f32],
        embedding_model: &str,
    ) -> AppResult<()> {
        let now = chrono::Utc::now().to_rfc3339();
        let affected = self.conn.execute(
            r#"UPDATE candidates SET
                name=?2, email=?3, phone=?4, email_norm=?5, phone_norm=?6,
                linkedin=?17, linkedin_norm=?18,
                location=?7, last_title=?8, experience_years=?9, skills=?10,
                languages=?11, education=?12, experiences=?13, full_text=?14,
                embedding=?15, updated_at=?16, embedding_model=?19
               WHERE id=?1"#,
            params![
                c.id,
                c.name,
                c.email,
                c.phone,
                norm_email(c.email.as_deref()),
                norm_phone(c.phone.as_deref()),
                c.location,
                c.last_title,
                c.experience_years,
                json(&c.skills),
                json(&c.languages),
                json(&c.education),
                json(&c.experiences),
                c.full_text,
                ai::embedding_to_bytes(embedding),
                now,
                c.linkedin,
                norm_linkedin(c.linkedin.as_deref()),
                embedding_model,
            ],
        )?;
        if affected == 0 {
            return Err(AppError::NotFound(format!("candidate {}", c.id)));
        }
        Ok(())
    }

    /// Update only the stored embedding + model stamp for a candidate. Used by
    /// re-indexing when the active model changes (no re-parsing).
    pub fn update_embedding(
        &self,
        id: i64,
        embedding: &[f32],
        embedding_model: &str,
    ) -> AppResult<()> {
        self.conn.execute(
            "UPDATE candidates SET embedding=?2, embedding_model=?3 WHERE id=?1",
            params![id, ai::embedding_to_bytes(embedding), embedding_model],
        )?;
        Ok(())
    }

    /// Ids + full text of candidates whose stored embedding is missing or was
    /// produced by a different model than `current_model`.
    pub fn candidates_needing_embedding(
        &self,
        current_model: &str,
    ) -> AppResult<Vec<(i64, String)>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, full_text FROM candidates
             WHERE embedding_model IS NULL OR embedding_model <> ?1",
        )?;
        let rows = stmt.query_map(params![current_model], |r| {
            Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?))
        })?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    /// Count of candidates not yet embedded with `current_model`.
    pub fn count_stale_embeddings(&self, current_model: &str) -> AppResult<usize> {
        let n: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM candidates
             WHERE embedding_model IS NULL OR embedding_model <> ?1",
            params![current_model],
            |r| r.get(0),
        )?;
        Ok(n as usize)
    }

    pub fn set_shortlist(&self, id: i64, value: bool) -> AppResult<()> {
        self.conn.execute(
            "UPDATE candidates SET in_shortlist=?2 WHERE id=?1",
            params![id, value as i32],
        )?;
        Ok(())
    }

    pub fn delete_candidate(&self, id: i64) -> AppResult<Option<String>> {
        let stored: Option<String> = self
            .conn
            .query_row(
                "SELECT stored_path FROM candidates WHERE id=?1",
                params![id],
                |r| r.get(0),
            )
            .optional()?
            .flatten();
        self.conn
            .execute("DELETE FROM candidates WHERE id=?1", params![id])?;
        Ok(stored)
    }

    pub fn clear_all(&self) -> AppResult<Vec<String>> {
        let mut stored = Vec::new();
        {
            let mut stmt = self
                .conn
                .prepare("SELECT stored_path FROM candidates WHERE stored_path IS NOT NULL")?;
            let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
            for r in rows {
                stored.push(r?);
            }
        }
        self.conn.execute_batch("DELETE FROM candidates;")?;
        Ok(stored)
    }

    pub fn get_candidate(&self, id: i64) -> AppResult<Candidate> {
        let mut c = self
            .conn
            .query_row(
                "SELECT * FROM candidates WHERE id=?1",
                params![id],
                row_to_candidate,
            )
            .optional()?
            .ok_or_else(|| AppError::NotFound(format!("candidate {id}")))?;
        c.duplicate_of = self.duplicates_of(&c)?;
        Ok(c)
    }

    pub fn get_embedding(&self, id: i64) -> AppResult<Vec<f32>> {
        let bytes: Vec<u8> = self.conn.query_row(
            "SELECT embedding FROM candidates WHERE id=?1",
            params![id],
            |r| r.get(0),
        )?;
        Ok(ai::embedding_from_bytes(&bytes))
    }

    /// All candidate summaries that pass the structured filters, newest first.
    /// Duplicate groups are computed once and used for both the `has_duplicates`
    /// flag and the optional duplicate-collapse filter.
    pub fn list_summaries(&self, f: &SearchFilters) -> AppResult<Vec<CandidateSummary>> {
        let groups = self.duplicate_groups()?;
        let mut out = Vec::new();
        for mut s in self.all_summaries_raw()? {
            if !filters::matches(&s, f, Some(&groups.representative)) {
                continue;
            }
            s.has_duplicates = groups.duplicated.contains(&s.id);
            out.push(s);
        }
        Ok(out)
    }

    /// Every candidate summary, unfiltered.
    pub(crate) fn all_summaries_raw(&self) -> AppResult<Vec<CandidateSummary>> {
        let sql = format!("SELECT {SUMMARY_COLS} FROM candidates ORDER BY updated_at DESC");
        let mut stmt = self.conn.prepare(&sql)?;
        let rows = stmt.query_map([], summary_from_row)?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    /// Summaries sharing a normalized contact identity (exact match).
    pub(crate) fn summaries_by_identity(
        &self,
        col: IdentityColumn,
        value: &str,
    ) -> AppResult<Vec<CandidateSummary>> {
        let sql = format!(
            "SELECT {SUMMARY_COLS} FROM candidates WHERE {} = ?1",
            col.column()
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let rows = stmt.query_map(params![value], summary_from_row)?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    /// Full extracted text for one candidate (used to build result snippets).
    pub(crate) fn candidate_text(&self, id: i64) -> AppResult<String> {
        let text: String = self.conn.query_row(
            "SELECT full_text FROM candidates WHERE id=?1",
            params![id],
            |r| r.get(0),
        )?;
        Ok(text)
    }

    /// One summary without the per-row duplicate lookup (callers that already
    /// hold `DuplicateGroups` set `has_duplicates` themselves).
    pub(crate) fn summary_by_id_raw(&self, id: i64) -> AppResult<CandidateSummary> {
        let sql = format!("SELECT {SUMMARY_COLS} FROM candidates WHERE id=?1");
        let s = self.conn.query_row(&sql, params![id], summary_from_row)?;
        Ok(s)
    }

    /// All embeddings for semantic search / clustering.
    pub fn all_embeddings(&self) -> AppResult<Vec<(i64, Vec<f32>)>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, embedding FROM candidates WHERE embedding IS NOT NULL")?;
        let rows = stmt.query_map([], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, Vec<u8>>(1)?)))?;
        let mut out = Vec::new();
        for r in rows {
            let (id, bytes) = r?;
            out.push((id, ai::embedding_from_bytes(&bytes)));
        }
        Ok(out)
    }

    pub fn shortlisted(&self) -> AppResult<Vec<Candidate>> {
        let mut stmt = self
            .conn
            .prepare("SELECT * FROM candidates WHERE in_shortlist=1 ORDER BY name")?;
        let rows = stmt.query_map([], row_to_candidate)?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    // ---- Duplicate detection ---------------------------------------------

    fn duplicates_of(&self, c: &Candidate) -> AppResult<Vec<i64>> {
        self.duplicate_ids_for(c.id)
    }

    fn duplicate_ids_for(&self, id: i64) -> AppResult<Vec<i64>> {
        let keys: Option<(Option<String>, Option<String>, Option<String>)> = self
            .conn
            .query_row(
                "SELECT email_norm, phone_norm, linkedin_norm FROM candidates WHERE id=?1",
                params![id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .optional()?;
        let (e, p, l) = match keys {
            Some(k) => k,
            None => return Ok(Vec::new()),
        };
        let mut stmt = self.conn.prepare(
            r#"SELECT DISTINCT id FROM candidates
               WHERE id <> ?1 AND (
                    (email_norm    IS NOT NULL AND email_norm    = ?2) OR
                    (phone_norm    IS NOT NULL AND phone_norm    = ?3) OR
                    (linkedin_norm IS NOT NULL AND linkedin_norm = ?4)
               )"#,
        )?;
        let rows = stmt.query_map(params![id, e, p, l], |r| r.get::<_, i64>(0))?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    /// One connected component per shared identity, computed once. Candidates
    /// that share an email *or* phone *or* LinkedIn are unioned (so transitive
    /// links, e.g. A~B by email and B~C by phone, form a single group). The
    /// member with the smallest id becomes the representative.
    pub(crate) fn duplicate_groups(&self) -> AppResult<DuplicateGroups> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, email_norm, phone_norm, linkedin_norm FROM candidates")?;
        let rows = stmt.query_map([], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, Option<String>>(1)?,
                r.get::<_, Option<String>>(2)?,
                r.get::<_, Option<String>>(3)?,
            ))
        })?;
        let mut records = Vec::new();
        let mut parent: HashMap<i64, i64> = HashMap::new();
        for r in rows {
            let rec = r?;
            parent.insert(rec.0, rec.0);
            records.push(rec);
        }

        for key_idx in [1usize, 2, 3] {
            let mut first_seen: HashMap<&str, i64> = HashMap::new();
            for rec in &records {
                let key = match key_idx {
                    1 => rec.1.as_deref(),
                    2 => rec.2.as_deref(),
                    _ => rec.3.as_deref(),
                };
                if let Some(k) = key {
                    match first_seen.get(k) {
                        Some(&other) => union(&mut parent, other, rec.0),
                        None => {
                            first_seen.insert(k, rec.0);
                        }
                    }
                }
            }
        }

        let mut sizes: HashMap<i64, usize> = HashMap::new();
        let mut representative = HashMap::with_capacity(records.len());
        for rec in &records {
            let root = find(&mut parent, rec.0);
            *sizes.entry(root).or_insert(0) += 1;
            representative.insert(rec.0, root);
        }

        let mut duplicated = HashSet::new();
        for (&id, &root) in &representative {
            if sizes.get(&root).copied().unwrap_or(0) > 1 {
                duplicated.insert(id);
            }
        }

        Ok(DuplicateGroups {
            representative,
            duplicated,
        })
    }
}

/// Union-find `find` with path compression, keeping the smallest id as root.
fn find(parent: &mut HashMap<i64, i64>, x: i64) -> i64 {
    let mut root = x;
    while parent.get(&root).copied().unwrap_or(root) != root {
        root = parent[&root];
    }
    let mut cur = x;
    while parent.get(&cur).copied().unwrap_or(cur) != root {
        let next = parent[&cur];
        parent.insert(cur, root);
        cur = next;
    }
    root
}

/// Union by minimum id, so a component's root is always its smallest id.
fn union(parent: &mut HashMap<i64, i64>, a: i64, b: i64) {
    let ra = find(parent, a);
    let rb = find(parent, b);
    if ra != rb {
        let (lo, hi) = if ra < rb { (ra, rb) } else { (rb, ra) };
        parent.insert(hi, lo);
    }
}

// ---- Row mapping ----------------------------------------------------------

fn row_to_candidate(r: &Row) -> rusqlite::Result<Candidate> {
    Ok(Candidate {
        id: r.get("id")?,
        name: r.get("name")?,
        email: r.get("email")?,
        phone: r.get("phone")?,
        linkedin: r.get("linkedin")?,
        location: r.get("location")?,
        last_title: r.get("last_title")?,
        experience_years: r.get("experience_years")?,
        skills: parse_json(r.get::<_, String>("skills")?),
        languages: parse_json(r.get::<_, String>("languages")?),
        education: parse_json(r.get::<_, String>("education")?),
        experiences: parse_json_experiences(r.get::<_, String>("experiences")?),
        source_path: r.get("source_path")?,
        stored_path: r.get("stored_path")?,
        full_text: r.get("full_text")?,
        created_at: r.get("created_at")?,
        updated_at: r.get("updated_at")?,
        duplicate_of: Vec::new(),
        in_shortlist: r.get::<_, i32>("in_shortlist")? != 0,
    })
}

fn summary_from_row(r: &Row) -> rusqlite::Result<CandidateSummary> {
    Ok(CandidateSummary {
        id: r.get(0)?,
        name: r.get(1)?,
        email: r.get(2)?,
        location: r.get(3)?,
        last_title: r.get(4)?,
        experience_years: r.get(5)?,
        skills: parse_json(r.get::<_, String>(6)?),
        in_shortlist: r.get::<_, i32>(7)? != 0,
        languages: parse_json(r.get::<_, String>(8)?),
        has_duplicates: false,
    })
}

// ---- Helpers --------------------------------------------------------------

fn json<T: serde::Serialize>(v: &T) -> String {
    serde_json::to_string(v).unwrap_or_else(|_| "[]".to_string())
}

fn parse_json(s: String) -> Vec<String> {
    serde_json::from_str(&s).unwrap_or_default()
}

fn parse_json_experiences(s: String) -> Vec<Experience> {
    serde_json::from_str(&s).unwrap_or_default()
}

pub fn norm_email(v: Option<&str>) -> Option<String> {
    let v = v?.trim().to_lowercase();
    if v.is_empty() || !v.contains('@') {
        None
    } else {
        Some(v)
    }
}

pub fn norm_phone(v: Option<&str>) -> Option<String> {
    let digits: String = v?.chars().filter(|c| c.is_ascii_digit()).collect();
    // keep the last 10 digits to ignore country-code inconsistencies
    let tail = if digits.len() > 10 {
        digits[digits.len() - 10..].to_string()
    } else {
        digits
    };
    if tail.len() >= 7 {
        Some(tail)
    } else {
        None
    }
}

pub fn norm_linkedin(v: Option<&str>) -> Option<String> {
    let v = v?.trim().to_lowercase();
    let v = v.trim_end_matches('/');
    if let Some(pos) = v.find("linkedin.com/") {
        Some(v[pos..].to_string())
    } else if v.is_empty() {
        None
    } else {
        Some(v.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mem_db() -> Db {
        let conn = Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "foreign_keys", "ON").unwrap();
        let db = Db { conn };
        db.init_schema().unwrap();
        db
    }

    fn sample(name: &str, email: Option<&str>) -> Candidate {
        Candidate {
            name: name.to_string(),
            email: email.map(|e| e.to_string()),
            skills: vec!["Rust".into(), "AWS".into()],
            full_text: format!("{name} is a Rust and AWS engineer"),
            source_path: format!("/tmp/{name}.pdf"),
            ..Default::default()
        }
    }

    #[test]
    fn insert_and_get() {
        let db = mem_db();
        let c = sample("Ada", Some("ada@example.com"));
        let emb = ai::embed_lexical(&c.full_text);
        let id = db.insert_candidate(&c, &emb, "test-model").unwrap();
        let got = db.get_candidate(id).unwrap();
        assert_eq!(got.name, "Ada");
        assert_eq!(got.skills, vec!["Rust", "AWS"]);
    }

    #[test]
    fn stores_and_reads_embedding() {
        let db = mem_db();
        let c = sample("Bruno", Some("b@example.com"));
        let emb = ai::embed_lexical(&c.full_text);
        let id = db.insert_candidate(&c, &emb, "test-model").unwrap();
        let all = db.all_embeddings().unwrap();
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].0, id);
        assert_eq!(all[0].1.len(), emb.len());
    }

    #[test]
    fn detects_duplicate_by_email() {
        let db = mem_db();
        let e = ai::embed_lexical("x");
        let id1 = db
            .insert_candidate(
                &sample("Ada One", Some("dup@example.com")),
                &e,
                "test-model",
            )
            .unwrap();
        let id2 = db
            .insert_candidate(
                &sample("Ada Two", Some("DUP@example.com")),
                &e,
                "test-model",
            )
            .unwrap();
        let dups = db.get_candidate(id1).unwrap().duplicate_of;
        assert!(dups.contains(&id2));
    }

    #[test]
    fn duplicate_groups_are_transitive() {
        let db = mem_db();
        let e = ai::embed_lexical("x");
        // A~B share an email, B~C share a phone -> one group of three.
        let a = Candidate {
            name: "A".into(),
            email: Some("a@x.com".into()),
            phone: Some("1111111".into()),
            source_path: "/a.pdf".into(),
            ..Default::default()
        };
        let b = Candidate {
            name: "B".into(),
            email: Some("A@X.com".into()),
            phone: Some("2222222".into()),
            source_path: "/b.pdf".into(),
            ..Default::default()
        };
        let c = Candidate {
            name: "C".into(),
            email: None,
            phone: Some("2222222".into()),
            source_path: "/c.pdf".into(),
            ..Default::default()
        };
        let ia = db.insert_candidate(&a, &e, "m").unwrap();
        let ib = db.insert_candidate(&b, &e, "m").unwrap();
        let ic = db.insert_candidate(&c, &e, "m").unwrap();

        let g = db.duplicate_groups().unwrap();
        assert_eq!(g.representative[&ia], ia);
        assert_eq!(g.representative[&ib], ia);
        assert_eq!(g.representative[&ic], ia);
        assert!(g.duplicated.contains(&ia));
        assert!(g.duplicated.contains(&ib));
        assert!(g.duplicated.contains(&ic));

        // Collapsing the group keeps only the representative.
        let f = SearchFilters {
            exclude_duplicates: true,
            ..Default::default()
        };
        let rows = db.list_summaries(&f).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].id, ia);
    }

    #[test]
    fn delete_removes_candidate() {
        let db = mem_db();
        let e = ai::embed_lexical("x");
        let id = db
            .insert_candidate(&sample("Chen", Some("c@example.com")), &e, "test-model")
            .unwrap();
        db.delete_candidate(id).unwrap();
        assert_eq!(db.all_embeddings().unwrap().len(), 0);
    }

    #[test]
    fn reindex_detects_stale_embeddings() {
        let db = mem_db();
        let e = ai::embed_lexical("x");
        db.insert_candidate(&sample("Ada", Some("a@example.com")), &e, "model-a")
            .unwrap();
        // Same model -> nothing stale; different model -> one stale.
        assert_eq!(db.count_stale_embeddings("model-a").unwrap(), 0);
        assert_eq!(db.count_stale_embeddings("model-b").unwrap(), 1);
        let stale = db.candidates_needing_embedding("model-b").unwrap();
        assert_eq!(stale.len(), 1);
    }

    #[test]
    fn phone_normalization_ignores_country_code() {
        assert_eq!(
            norm_phone(Some("+1 (555) 123-4567")),
            norm_phone(Some("555-123-4567"))
        );
    }
}
