/**
 * Shared data types mirrored from the Rust backend (`src-tauri/src/db.rs`).
 * Keep these in sync with the serde structs.
 */

export interface Experience {
  employer: string;
  title: string;
  period: string;
  description: string;
}

export interface Candidate {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  location: string | null;
  last_title: string | null;
  experience_years: number | null;
  skills: string[];
  languages: string[];
  education: string[];
  experiences: Experience[];
  source_path: string;
  stored_path: string | null;
  full_text: string;
  created_at: string;
  updated_at: string;
  /** Ids of other candidates that share an email/phone/linkedin identity. */
  duplicate_of: number[];
  in_shortlist: boolean;
}

export interface CandidateSummary {
  id: number;
  name: string;
  email: string | null;
  location: string | null;
  last_title: string | null;
  experience_years: number | null;
  skills: string[];
  languages: string[];
  in_shortlist: boolean;
  has_duplicates: boolean;
}

/** Structured post-filters. Every field is optional; absent values mean "any". */
export interface SearchFilters {
  location: string | null;
  min_experience: number | null;
  max_experience: number | null;
  last_title: string | null;
  /** Candidate must have all of these skills. */
  skills_all: string[];
  /** Candidate must have at least one of these skills. */
  skills_any: string[];
  /** Candidate must have none of these skills. */
  skills_exclude: string[];
  /** Candidate must speak all of these languages. */
  languages: string[];
  in_shortlist_only: boolean;
  /** Collapse duplicate groups (shared email/phone/LinkedIn) to one row. */
  exclude_duplicates: boolean;
}

/** How a result matched, used to pick a localized label in the UI. */
export type MatchKind = "email" | "phone" | "linkedin" | "name" | "semantic";

export interface SearchResult {
  candidate: CandidateSummary;
  score: number;
  match_kind: MatchKind;
  snippet: string;
}

export interface JobRequirement {
  label: string;
  kind: "skill" | "title" | "keyword";
}

export interface JobMatchResult {
  candidate: CandidateSummary;
  score: number;
  matched: string[];
  missing: string[];
  snippet: string;
}

export interface JobMatchResponse {
  requirements: JobRequirement[];
  results: JobMatchResult[];
}

export interface ImportError {
  file: string;
  error: string;
}

export interface ImportSummary {
  found: number;
  processed: number;
  failed: ImportError[];
}

export interface ImportProgress {
  found: number;
  processed: number;
  current_file: string;
}

export interface ModelFileInfo {
  name: string;
  url: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  /** One-line "what's the difference" hint for the model chooser. */
  short_desc: string;
  languages: string;
  size_bytes: number;
  downloaded: boolean;
  recommended: boolean;
  /** Whether this model is the currently active embedding model. */
  active: boolean;
  /** Primary download URL (the weights), shown in the UI. */
  url: string;
  /** Folder the model's files must live in (for manual installs). */
  dir: string;
  /** Every file that makes up the model, so a manual install is unambiguous. */
  files: ModelFileInfo[];
}

/** Byte-level progress for a model download, streamed from the backend. */
export interface ModelDownloadProgress {
  model_id: string;
  file_name: string;
  file_index: number;
  file_count: number;
  downloaded: number;
  total: number;
  done: boolean;
}

/** Progress of re-embedding the candidate base after a model change. */
export interface ReindexProgress {
  processed: number;
  total: number;
  done: boolean;
}

export interface AppSettings {
  data_dir: string;
  version: string;
  active_model: string | null;
  copy_originals: boolean;
}

/** Static application metadata for the About screen. */
export interface AppInfo {
  name: string;
  version: string;
  /** Git tag the build corresponds to, e.g. "v0.1.0". */
  tag: string;
  author: string;
  author_url: string;
  homepage: string;
  license: string;
}
