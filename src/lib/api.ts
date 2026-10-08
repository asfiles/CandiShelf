/**
 * Typed bridge to the Rust backend.
 *
 * Every call goes through Tauri's `invoke`. When the app is opened in a plain
 * browser (e.g. `npm run dev` without `tauri dev`), `invoke` is unavailable, so
 * we fall back to an in-memory mock. This keeps the UI demoable everywhere while
 * the real logic lives in Rust.
 */
import type {
  AppInfo,
  AppSettings,
  Candidate,
  CandidateSummary,
  ImportSummary,
  JobMatchResponse,
  ModelInfo,
  SearchFilters,
  SearchResult,
} from "./types";
import { mockBackend } from "./mockBackend";

type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

let cachedInvoke: InvokeFn | null = null;

async function getInvoke(): Promise<InvokeFn> {
  if (cachedInvoke) return cachedInvoke;
  if (isTauri()) {
    const core = await import("@tauri-apps/api/core");
    cachedInvoke = core.invoke as InvokeFn;
  } else {
    cachedInvoke = mockBackend as InvokeFn;
  }
  return cachedInvoke;
}

export async function call<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const invoke = await getInvoke();
  return invoke<T>(cmd, args);
}

// ---- Settings & lifecycle -------------------------------------------------

export const getSettings = () => call<AppSettings>("get_settings");
export const setDataDir = (dir: string) =>
  call<AppSettings>("set_data_dir", { dir });
export const setCopyOriginals = (value: boolean) =>
  call<AppSettings>("set_copy_originals", { value });
export const checkForUpdates = () => call<string>("check_for_updates");

// ---- About ----------------------------------------------------------------

export const getAppInfo = () => call<AppInfo>("get_app_info");

/** Open an external URL in the OS browser. */
export async function openExternal(url: string): Promise<void> {
  // In the browser demo there is no OS browser integration, so use a new tab.
  // In the desktop app the Rust `open_url` command validates the scheme
  // (http/https only) before handing the link to the OS.
  if (!isTauri()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  await call<void>("open_url", { url });
}

// ---- Models ---------------------------------------------------------------

export const listModels = () => call<ModelInfo[]>("list_models");
export const downloadModel = (id: string) =>
  call<ModelInfo[]>("download_model", { id });
export const deleteModel = (id: string) =>
  call<ModelInfo[]>("delete_model", { id });
export const setActiveModel = (id: string) =>
  call<ModelInfo[]>("set_active_model", { id });
export const modelChangeImpact = (id: string) =>
  call<number>("model_change_impact", { id });

// ---- Candidates -----------------------------------------------------------

export const listCandidates = (filters?: SearchFilters) =>
  call<CandidateSummary[]>("list_candidates", { filters: filters ?? null });
export const getCandidate = (id: number) =>
  call<Candidate>("get_candidate", { id });
export const updateCandidate = (candidate: Candidate) =>
  call<Candidate>("update_candidate", { candidate });
export const deleteCandidate = (id: number) =>
  call<void>("delete_candidate", { id });
export const reprocessCandidate = (id: number) =>
  call<Candidate>("reprocess_candidate", { id });
export const openOriginal = (id: number) =>
  call<void>("open_original", { id });

// ---- Import ---------------------------------------------------------------

export const importPaths = (paths: string[]) =>
  call<ImportSummary>("import_paths", { paths });
export const clearDatabase = () => call<void>("clear_database");

// ---- Search & matching ----------------------------------------------------

export const search = (query: string, filters?: SearchFilters) =>
  call<SearchResult[]>("search", {
    query,
    filters: filters ?? null,
  });

export const matchJob = (jobText: string) =>
  call<JobMatchResponse>("match_job", { jobText });

// ---- Shortlist ------------------------------------------------------------

export const setShortlist = (id: number, value: boolean) =>
  call<void>("set_shortlist", { id, value });
export const exportShortlistCsv = () => call<string>("export_shortlist_csv");

export { isTauri };
