# Changelog

All notable changes to **CandiShelf** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Versions match the Git release tags: the release workflow runs
`npm run set-version <tag>` before building, so a build from tag `v0.1.0`
displays version `0.1.0` (shown as `v0.1.0` in the app's **About** screen).

## [0.1.0] - 2026-09-26

Initial MVP release.

### Added

- **Resume import** for PDF, DOCX, and TXT — choose files, choose a folder, or
  drag & drop into the window. One failing document never stops the batch: you
  get a per-file error list, a progress indicator, and a success/failure count.
  Optionally copies original files into app storage.
- **Candidate cards** with name, email, phone, LinkedIn, location, last title,
  experience, skills, languages, education, work history, source file, and the
  full extracted text. Inline editing, open-original, re-process, and delete.
- **Duplicate detection**: multiple resumes from one person are flagged by shared
  email, phone, or LinkedIn.
- **Search**: hybrid search over candidates — natural-language semantic matching
  plus exact lookup by e-mail, phone, or LinkedIn URL and name matching (words
  in any order), with structured queries taking priority over semantic ones.
  Filters cover location, experience range (min/max), required and excluded
  skills, languages, and last job title, and can be limited to the shortlist or
  hide duplicates. Every result shows how it matched plus a snippet from the CV.
- **Match to a job**: paste a vacancy; CandiShelf extracts the requirements,
  ranks candidates, and shows matched vs. missing requirements with supporting
  excerpts. Results are a recommendation for a recruiter, never an automatic
  decision.
- **Shortlist** with CSV export.
- **Database management**: delete a candidate, clear the whole database, change
  the storage directory.
- **Settings** and a **first-run** screen: data directory, AI model management,
  and an update check.
- **About** screen: application version, author, license, and privacy/security
  notes.
- **Local AI**: on-device sentence embeddings via
  [candle](https://github.com/huggingface/candle) (pure-Rust ML runtime). Models
  are downloaded on first run with SHA-256 verification and can be removed from
  Settings.
- **Two selectable embedding models**, chosen and downloaded on first run and
  switchable in Settings:
  - `minilm-l6-en` — all-MiniLM-L6-v2, English, 87 MB.
  - `multilingual-l12` — paraphrase-multilingual-MiniLM-L12-v2, 50+ languages
    incl. Russian, 458 MB.
  The chooser shows each model's difference hint, download URL, and size.
- **Manual model install (no network)** — instead of downloading in-app, you can
  place the model files on disk yourself. The first-run screen and
  **Settings → AI models** print the exact target folder and the three required
  files (`model.safetensors`, `tokenizer.json`, `config.json`) with their URLs,
  detect files that are already present, and activate the model without touching
  the network.
- **Live download progress** (byte-level) during model download.
- **Model replacement in Settings** — switch or re-download a model; a
  confirmation explains that existing candidates will be re-embedded, and shows
  how many. Changing the model re-embeds the base with streamed progress.
- Each stored embedding records the model that produced it, so switching models
  re-embeds the base to match.

### Security

- Untrusted resume files are only ever **read as text** — never executed or
  rendered. Extracted text is sanitized (control-character stripping,
  CSV/formula-injection neutralization), text is length-capped, DOCX ZIP parts
  are size-capped against zip bombs, and PDF parsing is contained against panics.
- All SQL is parameterized; CSV export escapes spreadsheet-formula triggers.
- External links are restricted to `http`/`https`.
- Committed `package-lock.json` and `Cargo.lock`; CI installs with `npm ci` for
  reproducible, tamper-evident builds.
- CI fails on any high/critical advisory in **production** dependencies
  (`npm audit --omit=dev`); dev-only tooling advisories are reported but
  non-blocking.
- **npm supply-chain hardening**: `ignore-scripts=true` (dependency install
  scripts never run), exact pinned dependency versions enforced in CI,
  `npm audit` on high/critical, least-privilege CI permissions, and Dependabot
  updates.
- No telemetry; no network access after the optional model download.

### CI/CD

- GitHub Actions CI: lint/typecheck/test/build, Rust tests, and a verification
  build on Windows and macOS for PRs and `main`.
- Tag-triggered release (`v*.*.*`) building portable artifacts for Windows and
  macOS plus `SHA256SUMS.txt`, with a draft GitHub Release. The macOS build is a
  single universal (Intel + Apple Silicon) ad-hoc-signed `.app` packed with
  `ditto` into one archive that unpacks straight to `CandiShelf.app`.
