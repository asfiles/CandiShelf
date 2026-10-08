/**
 * In-memory mock of the Rust backend, used only when the app runs in a plain
 * browser (no Tauri runtime). It lets the whole UI be exercised for
 * development and testing. The real implementation lives in `src-tauri`.
 */
import type {
  AppSettings,
  Candidate,
  CandidateSummary,
  ImportSummary,
  JobMatchResponse,
  MatchKind,
  ModelInfo,
  SearchFilters,
  SearchResult,
} from "./types";

const now = () => new Date().toISOString();

function seededCandidates(): Candidate[] {
  const base: Array<Partial<Candidate> & { name: string }> = [
    {
      name: "Ada Kovács",
      email: "ada.kovacs@example.com",
      phone: "+36 30 111 2233",
      location: "Budapest, HU",
      last_title: "Senior DevOps Engineer",
      experience_years: 8,
      skills: ["Kubernetes", "AWS", "Terraform", "Go", "CI/CD"],
      languages: ["English", "Hungarian"],
      education: ["BSc Computer Science, ELTE"],
      full_text:
        "Senior DevOps Engineer with 8 years building platforms on AWS and " +
        "Kubernetes. Automated infrastructure with Terraform across fintech " +
        "workloads. Led migration to GitOps with ArgoCD.",
    },
    {
      name: "Bruno Almeida",
      email: "bruno.almeida@example.com",
      phone: "+351 912 000 111",
      location: "Lisbon, PT",
      last_title: "Cloud Security Engineer",
      experience_years: 6,
      skills: ["AWS", "IAM", "Threat Modeling", "Python", "Terraform"],
      languages: ["English", "Portuguese"],
      education: ["MSc Information Security, IST Lisbon"],
      full_text:
        "Security engineer focused on cloud infrastructure. Hardened AWS " +
        "accounts, built detection pipelines, and ran incident response. " +
        "Comfortable with Python tooling and Terraform.",
    },
    {
      name: "Chen Wei",
      email: "chen.wei@example.com",
      phone: "+65 8000 4321",
      location: "Singapore, SG",
      last_title: "Backend Engineer",
      experience_years: 4,
      skills: ["Java", "Spring", "PostgreSQL", "Kafka", "Docker"],
      languages: ["English", "Mandarin"],
      education: ["BEng Software Engineering, NUS"],
      full_text:
        "Backend engineer building high-throughput payment services with Java " +
        "and Spring. Designed event-driven systems on Kafka. Fintech domain.",
    },
  ];
  return base.map((c, i) => ({
    id: i + 1,
    email: null,
    phone: null,
    linkedin: null,
    location: null,
    last_title: null,
    experience_years: null,
    skills: [],
    languages: [],
    education: [],
    experiences: [],
    source_path: `/demo/resumes/${c.name.replace(/\s+/g, "_")}.pdf`,
    stored_path: null,
    full_text: "",
    created_at: now(),
    updated_at: now(),
    duplicate_of: [],
    in_shortlist: false,
    ...c,
  })) as Candidate[];
}

const db = {
  candidates: seededCandidates(),
  settings: {
    data_dir: "/home/user/.local/share/CandiShelf",
    version: "0.1.0",
    active_model: null,
    copy_originals: true,
  } as AppSettings,
  models: [
    {
      id: "minilm-l6-en",
      name: "MiniLM-L6 (English)",
      description:
        "sentence-transformers/all-MiniLM-L6-v2. Compact 6-layer model, 384-dim.",
      short_desc:
        "English only · small & fast (~{size}). Best if your resumes are in English.",
      languages: "English",
      size_bytes: 91_580_384,
      downloaded: false,
      recommended: true,
      active: false,
      url: "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/model.safetensors",
      dir: "/home/user/.local/share/CandiShelf/models/minilm-l6-en",
      files: [
        {
          name: "model.safetensors",
          url: "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/model.safetensors",
        },
        {
          name: "tokenizer.json",
          url: "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/tokenizer.json",
        },
        {
          name: "config.json",
          url: "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/config.json",
        },
      ],
    },
    {
      id: "multilingual-l12",
      name: "Multilingual MiniLM-L12",
      description:
        "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2. 12 layers, 384-dim.",
      short_desc:
        "50+ languages incl. Russian · larger & slower (~{size}). Pick this for non-English resumes.",
      languages: "50+ languages (incl. Russian, English)",
      size_bytes: 487_720_974,
      downloaded: false,
      recommended: false,
      active: false,
      url: "https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/resolve/main/model.safetensors",
      dir: "/home/user/.local/share/CandiShelf/models/multilingual-l12",
      files: [
        {
          name: "model.safetensors",
          url: "https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/resolve/main/model.safetensors",
        },
        {
          name: "tokenizer.json",
          url: "https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/resolve/main/tokenizer.json",
        },
        {
          name: "config.json",
          url: "https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/resolve/main/config.json",
        },
      ],
    },
  ] as ModelInfo[],
  nextId: 4,
};

function reflectActive() {
  db.models = db.models.map((m) => ({
    ...m,
    active: m.id === db.settings.active_model,
  }));
}

function toSummary(c: Candidate): CandidateSummary {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    location: c.location,
    last_title: c.last_title,
    experience_years: c.experience_years,
    skills: c.skills,
    languages: c.languages,
    in_shortlist: c.in_shortlist,
    has_duplicates: c.duplicate_of.length > 0,
  };
}

const norm = (list: string[]) => new Set(list.map((s) => s.toLowerCase()));
const hasAll = (cand: string[], wanted: string[]) => {
  const set = norm(cand);
  return wanted.filter((w) => w.trim()).every((w) => set.has(w.toLowerCase()));
};
const hasAny = (cand: string[], wanted: string[]) => {
  const set = norm(cand);
  return wanted.filter((w) => w.trim()).some((w) => set.has(w.toLowerCase()));
};
const containsCi = (hay: string | null, needle: string) =>
  (hay ?? "").toLowerCase().includes(needle.toLowerCase());

function applyFilters(list: Candidate[], filters?: SearchFilters | null) {
  let out = list;
  const f = filters;
  if (f?.location?.trim()) out = out.filter((c) => containsCi(c.location, f.location!));
  if (f?.min_experience != null)
    out = out.filter((c) => (c.experience_years ?? 0) >= f.min_experience!);
  if (f?.max_experience != null)
    out = out.filter((c) => (c.experience_years ?? 0) <= f.max_experience!);
  if (f?.last_title?.trim())
    out = out.filter((c) => containsCi(c.last_title, f.last_title!));
  if (f?.skills_all?.length) out = out.filter((c) => hasAll(c.skills, f.skills_all));
  if (f?.skills_any?.length) out = out.filter((c) => hasAny(c.skills, f.skills_any));
  if (f?.skills_exclude?.length) out = out.filter((c) => !hasAny(c.skills, f.skills_exclude));
  if (f?.languages?.length) out = out.filter((c) => hasAll(c.languages, f.languages));
  if (f?.in_shortlist_only) out = out.filter((c) => c.in_shortlist);
  return out;
}

// ---- Contact normalization (mirrors src-tauri/src/db.rs) ------------------

function normEmail(v: string): string | null {
  const s = v.trim().toLowerCase();
  return s.includes("@") ? s : null;
}
function normPhone(v: string): string | null {
  const digits = v.replace(/\D/g, "");
  const tail = digits.length > 10 ? digits.slice(-10) : digits;
  return tail.length >= 7 ? tail : null;
}
function normLinkedin(v: string): string | null {
  const s = v.trim().toLowerCase().replace(/\/+$/, "");
  const idx = s.indexOf("linkedin.com/");
  return idx >= 0 ? s.slice(idx) : s || null;
}

function detectIdentity(
  query: string,
): { kind: MatchKind; value: string } | null {
  const email = normEmail(query);
  if (email) return { kind: "email", value: email };
  if (!/[a-zа-яё]/i.test(query)) {
    const phone = normPhone(query);
    if (phone) return { kind: "phone", value: phone };
  }
  const lower = query.toLowerCase();
  if (lower.includes("linkedin.com") || lower.includes("/in/")) {
    const li = normLinkedin(query);
    if (li) return { kind: "linkedin", value: li };
  }
  return null;
}

function matchIdentity(c: Candidate, kind: MatchKind, value: string): boolean {
  if (kind === "email") return (c.email ?? "").trim().toLowerCase() === value;
  if (kind === "phone") return normPhone(c.phone ?? "") === value;
  return normLinkedin(c.linkedin ?? "") === value;
}

function looksLikeName(query: string): boolean {
  if (query.includes("@") || /\d/.test(query)) return false;
  const tokens = query.split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.length <= 4;
}

function snippetFor(text: string, terms: string[]): string {
  const lower = text.toLowerCase();
  for (const t of terms) {
    const idx = lower.indexOf(t.toLowerCase());
    if (idx >= 0) {
      const start = Math.max(0, idx - 40);
      return (
        (start > 0 ? "…" : "") +
        text.slice(start, idx + t.length + 60).trim() +
        "…"
      );
    }
  }
  return text.slice(0, 100).trim() + "…";
}

const delay = <T>(value: T, ms = 120): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

export async function mockBackend<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const a = args ?? {};
  switch (cmd) {
    case "get_settings":
      return delay(db.settings as unknown as T);
    case "set_data_dir":
      db.settings = { ...db.settings, data_dir: String(a.dir) };
      return delay(db.settings as unknown as T);
    case "set_copy_originals":
      db.settings = { ...db.settings, copy_originals: Boolean(a.value) };
      return delay(db.settings as unknown as T);
    case "check_for_updates":
      return delay("You are on the latest version (0.1.0)." as unknown as T);

    case "get_app_info":
      return delay({
        name: "CandiShelf",
        version: "0.1.0",
        tag: "v0.1.0",
        author: "Tony",
        author_url: "https://github.com/asfiles",
        homepage: "https://github.com/asfiles/CandiShelf",
        license: "AGPL-3.0-or-later",
      } as unknown as T);

    case "list_models":
      reflectActive();
      return delay(db.models as unknown as T);
    case "download_model": {
      db.models = db.models.map((m) =>
        m.id === a.id ? { ...m, downloaded: true } : m,
      );
      db.settings = { ...db.settings, active_model: String(a.id) };
      reflectActive();
      return delay(db.models as unknown as T, 400);
    }
    case "delete_model": {
      db.models = db.models.map((m) =>
        m.id === a.id ? { ...m, downloaded: false } : m,
      );
      if (db.settings.active_model === a.id) {
        db.settings = { ...db.settings, active_model: null };
      }
      reflectActive();
      return delay(db.models as unknown as T);
    }
    case "set_active_model": {
      db.settings = { ...db.settings, active_model: String(a.id) };
      reflectActive();
      return delay(db.models as unknown as T, 200);
    }
    case "model_change_impact":
      // In the demo every candidate would need re-embedding on a model switch.
      return delay(db.candidates.length as unknown as T);

    case "list_candidates": {
      const list = applyFilters(
        db.candidates,
        a.filters as SearchFilters | null,
      );
      return delay(list.map(toSummary) as unknown as T);
    }
    case "get_candidate":
      return delay(
        db.candidates.find((c) => c.id === a.id) as unknown as T,
      );
    case "update_candidate": {
      const incoming = a.candidate as Candidate;
      db.candidates = db.candidates.map((c) =>
        c.id === incoming.id ? { ...incoming, updated_at: now() } : c,
      );
      return delay(incoming as unknown as T);
    }
    case "delete_candidate":
      db.candidates = db.candidates.filter((c) => c.id !== a.id);
      return delay(undefined as unknown as T);
    case "reprocess_candidate":
      return delay(
        db.candidates.find((c) => c.id === a.id) as unknown as T,
        300,
      );
    case "open_original":
      return delay(undefined as unknown as T);
    case "open_url": {
      // Browser demo: open in a new tab after validating the scheme.
      const url = String(a.url ?? "");
      if (url.startsWith("http://") || url.startsWith("https://")) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      return delay(undefined as unknown as T);
    }

    case "import_paths": {
      const paths = (a.paths as string[]) ?? [];
      const summary: ImportSummary = {
        found: paths.length,
        processed: paths.length,
        failed: [],
      };
      return delay(summary as unknown as T, 400);
    }
    case "clear_database":
      db.candidates = [];
      return delay(undefined as unknown as T);

    case "search": {
      const query = String(a.query ?? "").trim();
      const terms = query.split(/\s+/).filter(Boolean);
      const filtered = applyFilters(
        db.candidates,
        a.filters as SearchFilters | null,
      );

      const toResult = (
        c: Candidate,
        kind: MatchKind,
        score: number,
      ): SearchResult => ({
        candidate: toSummary(c),
        score,
        match_kind: kind,
        snippet: snippetFor(c.full_text, terms),
      });

      // Tier 0 — exact contact identity (an address query is not semantic).
      const identity = detectIdentity(query);
      if (identity) {
        const results = filtered
          .filter((c) => matchIdentity(c, identity.kind, identity.value))
          .map((c) => toResult(c, identity.kind, 1));
        return delay(results as unknown as T, 200);
      }

      // Tier 1 — name match for name-like queries.
      if (looksLikeName(query)) {
        const lower = terms.map((t) => t.toLowerCase());
        const results = filtered
          .filter((c) =>
            lower.every((t) => c.name.toLowerCase().includes(t)),
          )
          .map((c) => toResult(c, "name", 0.9));
        if (results.length > 0) return delay(results as unknown as T, 200);
      }

      // Tier 2 — keyword "semantic" fallback (demo stand-in for embeddings).
      const results: SearchResult[] = filtered
        .map((c) => {
          const hay = (
            c.full_text +
            " " +
            c.skills.join(" ") +
            " " +
            (c.last_title ?? "")
          ).toLowerCase();
          const hits = terms.filter((t) => hay.includes(t.toLowerCase()));
          const score = terms.length ? hits.length / terms.length : 0.5;
          return toResult(c, "semantic", score);
        })
        .filter((r) => r.score > 0)
        .sort((x, y) => y.score - x.score);
      return delay(results as unknown as T, 200);
    }

    case "match_job": {
      const text = String(a.jobText ?? "");
      const known = [
        "Kubernetes",
        "AWS",
        "Terraform",
        "Python",
        "Go",
        "Docker",
        "Kafka",
        "IAM",
        "Java",
        "Spring",
      ];
      const requirements = known
        .filter((k) => text.toLowerCase().includes(k.toLowerCase()))
        .map((label) => ({ label, kind: "skill" as const }));
      const results = db.candidates
        .map((c) => {
          const matched = requirements
            .map((r) => r.label)
            .filter((label) =>
              c.skills.some((s) => s.toLowerCase() === label.toLowerCase()),
            );
          const missing = requirements
            .map((r) => r.label)
            .filter((label) => !matched.includes(label));
          const score = requirements.length
            ? matched.length / requirements.length
            : 0;
          return {
            candidate: toSummary(c),
            score,
            matched,
            missing,
            snippet: snippetFor(c.full_text, matched),
          };
        })
        .sort((x, y) => y.score - x.score);
      return delay(
        { requirements, results } as JobMatchResponse as unknown as T,
        250,
      );
    }

    case "set_shortlist":
      db.candidates = db.candidates.map((c) =>
        c.id === a.id ? { ...c, in_shortlist: Boolean(a.value) } : c,
      );
      return delay(undefined as unknown as T);
    case "export_shortlist_csv":
      return delay(
        "/home/user/.local/share/CandiShelf/shortlist.csv" as unknown as T,
      );

    default:
      throw new Error(`mockBackend: unhandled command "${cmd}"`);
  }
}
