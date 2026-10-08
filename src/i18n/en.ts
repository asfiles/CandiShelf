/**
 * English UI strings — the source of truth for the key set.
 *
 * `ru.ts` is typed as `Record<TranslationKey, Entry>`, so TypeScript fails the
 * build if the two dictionaries ever drift apart.
 */

import { enPlural } from "./plural";
import type { Dict, TParams } from "./types";

export const en = {
  // ---- Shared ------------------------------------------------------------
  "common.loading": "Loading…",
  "common.working": "Working…",
  "common.cancel": "Cancel",
  "common.confirm": "Confirm",
  "common.close": "Close",
  "common.unknownRole": "Unknown role",
  "common.recommended": "Recommended",
  "common.none": "—",

  // ---- App shell ---------------------------------------------------------
  "app.subtitle": "Local resume shelf",
  "app.aboutTitle": "About CandiShelf",
  "nav.candidates": "Candidates",
  "nav.import": "Import",
  "nav.match": "Match to job",
  "nav.settings": "Settings",
  "nav.about": "About",

  // ---- Language switcher -------------------------------------------------
  "language.en": "English",
  "language.ru": "Русский",

  // ---- Home / candidates -------------------------------------------------
  "home.title": "Candidates",
  "home.count": (p: TParams) =>
    `${p.count} ${enPlural(Number(p.count), "candidate", "candidates")} in your local shelf`,
  "home.shortlisted": (p: TParams) => `${p.count} shortlisted`,
  "home.exportShortlist": "Export shortlist",
  "home.matchToJob": "Match to job",
  "home.addResumes": "Add resumes",
  "home.searchPlaceholder":
    "Search by name, e-mail, phone, or describe who you're looking for",
  "home.search": "Search",
  "home.filterLocation": "Filter by location",
  "home.anyExperience": "Any experience",
  "home.anyMax": "No maximum",
  "home.minYears": (p: TParams) => `${p.count}+ years`,
  "home.maxYears": (p: TParams) => `up to ${p.count} years`,
  "home.filters": (p: TParams) =>
    Number(p.count) > 0 ? `Filters (${p.count})` : "Filters",
  "home.clearFilters": "Clear filters",
  "home.filterTitle": "Job title",
  "home.filterSkillsAll": "Skills — all, comma-separated",
  "home.filterSkillsExclude": "Exclude skills",
  "home.filterLanguages": "Languages, comma-separated",
  "home.filterShortlistOnly": "Shortlisted only",
  "home.filterExcludeDuplicates": "Hide duplicates",
  "home.searchFailed": "Search failed: {error}",
  "home.exported": "Shortlist exported to {path}",
  "home.exportFailed": "Export failed: {error}",
  "home.addShortlist": "Add to shortlist",
  "home.removeShortlist": "Remove from shortlist",
  "home.noMatches": "No matches",
  "home.noMatchesHint": "Try rephrasing your query in natural language.",
  "home.emptyTitle": "Your shelf is empty",
  "home.emptyHint":
    "Import PDF, DOCX, or TXT resumes to build your local candidate base.",

  // ---- Search match kinds ------------------------------------------------
  "search.match.email": "Exact e-mail match",
  "search.match.phone": "Exact phone match",
  "search.match.linkedin": "Exact LinkedIn match",
  "search.match.name": "Name match",
  "search.match.semantic": "Semantic match",

  // ---- Import ------------------------------------------------------------
  "import.title": "Import resumes",
  "import.subtitle": "Add PDF, DOCX, or TXT documents to your local shelf.",
  "import.back": "Back to candidates",
  "import.dropTitle": "Drag & drop resumes here",
  "import.dropHint": "Files are processed locally. Nothing is uploaded.",
  "import.chooseFiles": "Choose files",
  "import.chooseFolder": "Choose folder",
  "import.fileFilter": "Resumes",
  "import.processing": "Processing documents…",
  "import.extractingFile": "Extracting {file}…",
  "import.extracting":
    "Extracting text, parsing fields, and building embeddings locally.",
  "import.found": "Documents found",
  "import.processed": "Successfully processed",
  "import.failed": "Failed",
  "import.viewCandidates": "View candidates",
  "import.doneAll": (p: TParams) =>
    `Imported ${p.processed} of ${p.found} documents.`,
  "import.donePartial": (p: TParams) =>
    `Imported ${p.processed}, ${p.failed} failed.`,
  "import.failedToast": "Import failed: {error}",
  "import.noPaths": "Could not read dropped file paths.",

  // ---- Match to job ------------------------------------------------------
  "match.title": "Match to job",
  "match.subtitle":
    "Paste a job description. CandiShelf extracts the requirements and ranks your candidates — a recommendation for you, not an automated decision.",
  "match.jobLabel": "Job description",
  "match.jobPlaceholder": "Paste the full vacancy text here…",
  "match.analyse": "Analysing…",
  "match.find": "Find matching candidates",
  "match.sample": "Use sample vacancy",
  "match.sampleText": `Senior DevOps Engineer

We are looking for a DevOps engineer with strong experience in Kubernetes,
AWS, and Terraform. Fintech background is a plus. You will own our CI/CD
pipelines and cloud infrastructure.`,
  "match.requirements": "Detected requirements",
  "match.noRequirements":
    "No specific requirements detected. Try a more detailed vacancy.",
  "match.ranked": "Ranked candidates",
  "match.needText": "Paste a job description first.",
  "match.failed": "Matching failed: {error}",

  // ---- Settings ----------------------------------------------------------
  "settings.title": "Settings",
  "settings.subtitle": "Manage storage, models, and data.",
  "settings.language": "Language",
  "settings.languageHint":
    "Interface language. It follows your system by default; switch it here anytime.",
  "settings.dataDir": "Data directory",
  "settings.dataDirHint":
    "Database, embeddings, models, and settings live here.",
  "settings.change": "Change",
  "settings.copyOriginals":
    "Copy original resume files into the app storage (so they stay available even if the source is moved)",
  "settings.models": "AI models",
  "settings.modelsHint":
    "Search and job matching run on the active local model. Switching or re-downloading a model re-embeds your existing candidates so they stay searchable in the new model's space.",
  "settings.active": "Active",
  "settings.downloaded": "Downloaded",
  "settings.notDownloaded": "Not downloaded",
  "settings.use": "Use",
  "settings.redownload": "Re-download",
  "settings.remove": "Remove",
  "settings.download": "Download",
  "settings.reembedding": "Re-embedding candidates…",
  "settings.updates": "Updates & status",
  "settings.version": "Version {v}",
  "settings.checkUpdates": "Check for updates",
  "settings.danger": "Danger zone",
  "settings.clearTitle": "Clear all data",
  "settings.clearHint":
    "Deletes every candidate and their embeddings. Models are kept.",
  "settings.clearButton": "Clear database",
  "settings.clearConfirmTitle": "Clear the entire database?",
  "settings.clearConfirmMsg":
    "This permanently removes all candidates, extracted text, and embeddings. This cannot be undone.",
  "settings.clearConfirmLabel": "Clear everything",
  "settings.tDirPicker": "Directory picker is available in the desktop app.",
  "settings.tDirUpdated": "Data directory updated.",
  "settings.tDownloaded": "{name} downloaded and activated.",
  "settings.tDownloadFailed": "Download failed: {error}",
  "settings.tRedownloaded": "{name} re-downloaded and activated.",
  "settings.tSwitched": "Switched to {name}.",
  "settings.tOpFailed": "Operation failed: {error}",
  "settings.tRemoved": "{name} removed.",
  "settings.tCleared": "All data cleared.",
  "settings.tClearFailed": "Failed to clear: {error}",
  "settings.tUpdateFailed": "Update check failed: {error}",
  "settings.tUpdateMsg":
    "You are on version {v}. New versions are published on GitHub Releases; updating means downloading the latest portable file.",
  "settings.switchTitle": "Switch to {name}?",
  "settings.reDownloadTitle": "Re-download {name}?",
  "settings.switchMsgRe": "The current copy will be removed and downloaded again.",
  "settings.switchMsgActive":
    "This model becomes the active one for all search and job matching.",
  "settings.switchImpact": (p: TParams) =>
    `CandiShelf will then re-embed ${p.count} ${enPlural(
      Number(p.count),
      "candidate",
      "candidates",
    )} so they match the new model. Existing candidates stay; only their embeddings are recomputed. This can take a little while for large bases.`,
  "settings.switchImpactNone":
    "Your candidate base is empty, so nothing needs re-embedding.",
  "settings.switchConfirm": "Switch model",
  "settings.reDownloadConfirm": "Re-download",

  // ---- About -------------------------------------------------------------
  "about.title": "About",
  "about.subtitle": "Application information.",
  "about.tagline": "Local, offline-first resume shelf",
  "about.details": "Details",
  "about.version": "Version",
  "about.build": "(build {v})",
  "about.author": "Author",
  "about.homepage": "Homepage",
  "about.license": "License",
  "about.privacy": "Privacy & security",
  "about.privacy1":
    "Everything runs locally. Resumes and candidate data never leave this device.",
  "about.privacy2":
    "File contents are only ever read as text — never executed or rendered. Extracted text is sanitized, SQL is fully parameterized, and downloads are checksum-verified.",
  "about.privacy3":
    "The build is hardened against npm supply-chain attacks: dependency install scripts are disabled, versions are pinned exactly, and dependencies are audited in CI.",
  "about.data": "Data",
  "about.dataText":
    "Your database, embeddings, downloaded models, and settings are stored in your user data directory (see Settings).",
  "about.infoFailed": "Could not load app info: {error}",
  "about.openFailed": "Could not open link: {error}",

  // ---- First run ---------------------------------------------------------
  "firstrun.welcome": "Welcome to CandiShelf",
  "firstrun.language": "Language",
  "firstrun.intro":
    "CandiShelf finds candidates with a local AI model — search and job matching are powered entirely by on-device language models, so no resume ever leaves your machine. Choose a model to download once; afterwards everything works offline.",
  "firstrun.chooseModel": "Choose an embedding model",
  "firstrun.downloadingVerify": "Downloading & verifying…",
  "firstrun.downloading": "Downloading…",
  "firstrun.downloadSelected": "Download selected model",
  "firstrun.note":
    "Downloads are checksum-verified. You can switch or re-download models later in Settings.",
  "firstrun.tDownloaded": "Model downloaded and verified.",
  "firstrun.tDownloadFailed": "Download failed: {error}",
  "firstrun.available": "Installed",
  "firstrun.useSelected": "Use selected model",
  "firstrun.tActivated": "Model activated.",
  "firstrun.tActivateFailed": "Could not activate model: {error}",

  // ---- Manual model install ---------------------------------------------
  "model.manualTitle": "No internet? Install a model by hand",
  "model.manualHint":
    "CandiShelf reads the model from disk — downloading is the only network access and it is optional. Fetch the files with any tool (a browser, curl, wget) and drop them into the folder below. CandiShelf will detect the model and download nothing.",
  "model.manualFolder": "Put the files in this folder:",
  "model.manualFiles": "Required files:",
  "model.manualDetected":
    "Files already found — you can use this model without downloading.",

  // ---- Candidate drawer --------------------------------------------------
  "drawer.loading": "Loading…",
  "drawer.possibleDuplicate":
    "⚠ Possible duplicate of candidate #{ids} (shared email, phone, or LinkedIn).",
  "drawer.openOriginal": "Open original",
  "drawer.save": "Save changes",
  "drawer.edit": "Edit",
  "drawer.reprocess": "Re-process",
  "drawer.delete": "Delete",
  "drawer.toggleShortlist": "Toggle shortlist",
  "drawer.contact": "Contact",
  "drawer.email": "Email",
  "drawer.phone": "Phone",
  "drawer.linkedin": "LinkedIn",
  "drawer.location": "Location",
  "drawer.fieldExperience": "Experience",
  "drawer.skills": "Skills",
  "drawer.languages": "Languages",
  "drawer.education": "Education",
  "drawer.workExperience": "Experience",
  "drawer.sourceFile": "Source file",
  "drawer.extractedText": "Extracted text",
  "drawer.noText": "No text extracted.",
  "drawer.deleteTitle": "Delete candidate?",
  "drawer.deleteMsg":
    "This permanently removes the profile, extracted text, embeddings, and any copied original document.",
  "drawer.deleteConfirm": "Delete permanently",
  "drawer.tUpdated": "Candidate updated.",
  "drawer.tUpdateFailed": "Update failed: {error}",
  "drawer.tDeleted": "Candidate and all associated data deleted.",
  "drawer.tDeleteFailed": "Delete failed: {error}",
  "drawer.tReprocessed": "Resume re-processed.",
  "drawer.tReprocessFailed": "Re-process failed: {error}",

  // ---- Candidate row -----------------------------------------------------
  "row.shortlist": "Shortlist",
  "row.duplicate": "Duplicate",
  "row.duplicateTitle": "Possible duplicate resume",

  // ---- Experience label --------------------------------------------------
  "exp.lessThanOne": "<1 yr",
  "exp.years": (p: TParams) =>
    `${p.count} yr${Number(p.count) === 1 ? "" : "s"}`,
} satisfies Dict;

export type TranslationKey = keyof typeof en;
