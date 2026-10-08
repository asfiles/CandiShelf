# CandiShelf

**English** · [Русский](README.ru.md)

**Private candidate search powered by local AI. No accounts, API keys, or cloud processing.**

Local, offline-first resume shelf for independent recruiters and small teams.

CandiShelf loads a collection of resumes, extracts candidate information, builds a
local database, and lets you search candidates and match them
to a job description — **entirely on your machine**. No resume is ever uploaded to
any external service. There is nothing to set up by hand: on first launch
CandiShelf downloads and verifies its local AI model automatically, and everything
runs offline from then on.

**User manual:** [English](manual/README.md) · [Русский](manual/README.ru.md)

> CandiShelf is a candidate shelf, not an ATS. It gives recommendations for a
> human recruiter to act on; it never auto-rejects or auto-hires anyone.

---

## Features

**Import**
- Load PDF, DOCX, and TXT resumes: choose files, choose a folder, or drag & drop.
- Live progress, document count, and a per-file error list — one bad file never
  stops the batch. Optionally copies originals into app storage.

**Candidate card**
- Name, email, phone, LinkedIn, location, last title, experience, skills,
  languages, education, and work history.
- Full extracted text and the source file; open the original in one click.
- Edit any extracted field, re-process a resume, or delete a candidate.

**Search**
- Natural-language semantic search powered by a local sentence-embedding model —
  describe who you're looking for (e.g. "DevOps engineer with fintech
  experience") and candidates are ranked by meaning, not keywords.
- Exact lookup for structured queries: type a full e-mail, phone number, or
  LinkedIn URL to jump straight to that person, or a name to match its words in
  any order. These take priority over semantic matches.
- Filters: location, experience range (minimum and maximum), required and
  excluded skills, languages, and last job title — plus shortlisted-only and
  hide-duplicates.
- Every result shows *how* it matched (exact e-mail / phone / LinkedIn, name, or
  semantic) plus a snippet from the CV.

**Match to a job**
- Paste a vacancy; CandiShelf extracts the requirements, ranks candidates, and
  shows matched vs. missing requirements with supporting excerpts.

**Duplicates & shortlist**
- Resumes from one person are flagged by shared email / phone / LinkedIn.
- Shortlist candidates and export to CSV.

**Database & settings**
- Delete a candidate, clear the whole database, or move storage to another folder.
- Manage AI models, change the data directory, check for updates.
- **Interface language** — English and Russian. The UI follows your OS locale
  automatically (a Russian locale selects Russian, anything else English) and can
  be switched with one click in Settings; the choice is remembered.
- **About** screen with the app version, author, and license.

**Privacy & security**
- Everything runs locally; no telemetry, and no network after the optional model
  download. Untrusted files are only ever *read as text* — never executed or
  rendered; extracted text is sanitized, SQL is fully parameterized, DOCX ZIPs
  are size-capped against zip bombs, and downloads are checksum-verified.

## Architecture

| Layer      | Tech                                                            |
| ---------- | -------------------------------------------------------------- |
| Shell      | [Tauri 2](https://tauri.app) (Rust)                            |
| UI         | React 18 + TypeScript + Vite                                   |
| Database   | SQLite (bundled) for candidates + embeddings                   |
| AI runtime | On-device embeddings via [candle](https://github.com/huggingface/candle) (pure-Rust; MiniLM sentence-transformers). Models downloaded on first run, checksum-verifiable |
| CI/CD      | GitHub Actions (native Windows/macOS runners)                 |

```
src/                     React + TypeScript frontend
  screens/               Home, Import, Job match, Settings, About, First-run
  components/            Reusable UI (icons, modal, toast, candidate row)
  lib/                   API bridge, types, mock backend, formatters
src-tauri/               Rust backend
  src/extract/           PDF / DOCX / TXT text extraction + sanitization
  src/ai/                Embeddings (candle) + model download/verification
  src/db.rs              SQLite candidates + duplicate detection
  src/parser.rs          Heuristic field extraction
  src/filters.rs         Shared structured filters (list + search)
  src/search.rs          Hybrid search (contact / name / semantic) + job matching
  src/importer.rs        Import pipeline (discovery, per-file isolation)
  src/export.rs          Shortlist CSV export
  src/commands.rs        Tauri IPC command handlers
.github/workflows/       CI (tests + verification build) and Release
```

## Data storage

User data lives outside the executable, per platform convention:

```
Windows: %LOCALAPPDATA%\CandiShelf\
macOS:   ~/Library/Application Support/CandiShelf/
```

It contains the local database and embeddings, downloaded models,
settings, and (optionally) copied original resumes. Logs never contain resume
contents. You can change the storage directory in Settings.

## Development

Prerequisites: [Node.js 20.19+](https://nodejs.org), the
[Rust toolchain](https://rustup.rs), and the
[Tauri 2 system prerequisites](https://v2.tauri.app/start/prerequisites/) for
your OS (on Debian/Ubuntu: `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`,
`librsvg2-dev`, `patchelf`, `libappindicator3-dev`).

```bash
npm install          # install frontend deps

npm run dev          # run the UI in a browser (uses an in-memory mock backend)
npm run tauri dev    # run the full desktop app (real Rust backend)

# Quality gate
npm run lint
npm run typecheck
npm test                       # frontend unit tests (Vitest)
cargo test --manifest-path src-tauri/Cargo.toml   # Rust tests
```

> Running `npm run dev` alone opens the app in a plain browser. Because there is
> no Tauri runtime there, the app transparently falls back to an **in-memory mock
> backend** so the whole UI is explorable without building Rust. Use
> `npm run tauri dev` for the real, persistent backend.

### Regenerating icons

```bash
python3 scripts/gen_icons.py   # writes src-tauri/icons/* and public/icon.png
```

### Supply-chain hardening (npm)

The dependency install path is hardened against npm supply-chain attacks:

- **`ignore-scripts=true`** (`.npmrc`) — dependency install/lifecycle scripts do
  not run during `npm install`. This blocks the most common attack: a malicious
  or compromised package executing code via a `postinstall` script. Project
  scripts (`npm run dev|build|test|tauri`) still run normally. If a dependency
  genuinely needs its build step, allow it deliberately with `npm rebuild <pkg>`.
- **Exact, pinned versions** — `save-exact=true` plus exact versions in
  `package.json`; CI fails if any floating range (`^`, `~`, `*`, `latest`) is
  introduced.
- **Dependency audit** — a dedicated CI job runs `npm audit --audit-level=high`
  and fails on high/critical advisories.
- **Lean CI permissions** — workflows run with `contents: read`.
- **Dependabot** — weekly, reviewable PRs for npm, Cargo, and GitHub Actions.

> Recommended further step: pin GitHub Actions to full commit SHAs (currently
> pinned to major version tags) so a moved/compromised action tag cannot affect
> the build.

### Versioning (tag ↔ app)

The version shown in the app (sidebar and **About** screen) always equals the Git
tag. The release workflow runs `npm run set-version <tag>` before building, which
updates `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`
together, so a build from tag `v0.1.0` displays `v0.1.0` (`0.1.0` from Cargo).
Every release's notes are generated from [CHANGELOG.md](CHANGELOG.md).

## AI models

Search and job matching are **powered entirely by a local language model**. To
keep the portable file small, models are **not** bundled; on first launch you
choose one and download it once. Everything then runs offline, and no resume
ever leaves your machine.

| Model | Languages | Size | Notes |
| --- | --- | --- | --- |
| `minilm-l6-en` (all-MiniLM-L6-v2) | English | 87 MB | Small & fast; best for English resumes |
| `multilingual-l12` (paraphrase-multilingual-MiniLM-L12-v2) | 50+ incl. Russian | 458 MB | Larger & slower; pick for non-English resumes |

Both produce 384-dimensional embeddings and run on the CPU via
[candle](https://github.com/huggingface/candle). Downloads are checksum-verified
against a pinned SHA-256 (in `ai/mod.rs`). In **Settings → AI models** you
can switch or re-download the active model; because different models live in
different embedding spaces, changing the model automatically re-embeds your
existing candidates (with progress), so search stays consistent.

### Installing a model manually (no download)

Downloading is optional. CandiShelf only ever **reads** the model files from disk
— fetching them is the app's only network access. On a machine without internet,
download the files elsewhere with any tool (a browser, `curl`, `wget`) and place
them in the model's folder under your data directory (see
[Data storage](#data-storage)):

```
<data dir>/models/minilm-l6-en/       # English model
<data dir>/models/multilingual-l12/   # multilingual model
```

Each folder needs exactly three files — the names are the same for both models:

| File | Purpose |
| --- | --- |
| `model.safetensors` | model weights |
| `tokenizer.json` | tokenizer |
| `config.json` | model configuration |

**English — `all-MiniLM-L6-v2`** → place into `<data dir>/models/minilm-l6-en/`:

- <https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/1110a243fdf4706b3f48f1d95db1a4f5529b4d41/model.safetensors>
- <https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/1110a243fdf4706b3f48f1d95db1a4f5529b4d41/tokenizer.json>
- <https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/1110a243fdf4706b3f48f1d95db1a4f5529b4d41/config.json>

**Multilingual — `paraphrase-multilingual-MiniLM-L12-v2`** → place into
`<data dir>/models/multilingual-l12/`:

- <https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/resolve/e8f8c211226b894fcb81acc59f3b34ba3efd5f42/model.safetensors>
- <https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/resolve/e8f8c211226b894fcb81acc59f3b34ba3efd5f42/tokenizer.json>
- <https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/resolve/e8f8c211226b894fcb81acc59f3b34ba3efd5f42/config.json>

For example, the English model in one go:

```bash
BASE=https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/1110a243fdf4706b3f48f1d95db1a4f5529b4d41
DEST="${XDG_DATA_HOME:-$HOME/.local/share}/CandiShelf/models/minilm-l6-en"
mkdir -p "$DEST"
for f in model.safetensors tokenizer.json config.json; do
  curl -L "$BASE/$f" -o "$DEST/$f"
done
```

Once the files are in place, CandiShelf detects the model (shown as
**Installed**) and activates it without downloading anything. The exact folder
and file list for each model are shown on the first-run screen and in
**Settings → AI models**.

> The tokenizer's regex backend (`onig`) is a build-time-only C dependency
> (bundled source, statically linked). Unlike an ONNX Runtime dependency there is
> no runtime shared library to ship or code-sign, so cross-platform packaging
> stays simple.

## Building portable releases

Native, installer-free artifacts are produced by GitHub Actions on the matching
OS runners. Pushing a tag like `v0.1.0` builds and publishes a GitHub Release:

```
candishelf-Windows-x64.exe
candishelf-macOS-Universal.zip
SHA256SUMS.txt
```

The Windows build is a single portable `.exe` — no installer. The macOS build is
one **universal** `.zip` (Intel + Apple Silicon) that unpacks straight to
`CandiShelf.app` — unzip it, then open the app.

- **PRs** run tests + a verification build on both Windows and macOS.
- **Merges to `main`** run the test build.
- **Tags `v*.*.*`** produce a production release with checksummed portable files.

macOS and Windows builds are not code-signed, so macOS Gatekeeper and Windows
SmartScreen may warn on first launch. The macOS app is ad-hoc signed, so on first
launch Gatekeeper asks once — allow it via **System Settings → Privacy &
Security → Open Anyway** (or right-click the app → **Open**). From Terminal you
can instead clear the download flag:

```bash
xattr -dr com.apple.quarantine /Applications/CandiShelf.app
```

Removing the Gatekeeper prompt entirely requires a paid Apple Developer ID and
notarization.

### Cutting a release

1. In [CHANGELOG.md](CHANGELOG.md), add the release's changes under a new
   `## [x.y.z] - YYYY-MM-DD` heading.
2. Commit, then create and push a tag:

   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

3. GitHub Actions builds every platform, syncs the app version to the tag,
   generates the release notes from the changelog section for that version, and
   publishes the release with checksums.

## What's intentionally out of scope (MVP)

Accounts/auth, multi-user, a server version, SSO/roles, email/calendar, job
posting, a full ATS pipeline, complex-scan OCR, automatic updates, LinkedIn
integrations, cloud backup, and automatic candidate rejection.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the version history.

## License

CandiShelf is free software, licensed under the **GNU Affero General Public
License, version 3 or later** — SPDX identifier `AGPL-3.0-or-later`. You may use,
study, share, and modify it under the terms of that license; derivative works and
networked deployments must offer their users the corresponding source. See
[LICENSE](LICENSE) for the full text, or
<https://www.gnu.org/licenses/agpl-3.0.html>.
