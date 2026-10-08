import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { importPaths } from "../lib/api";
import { isTauri } from "../lib/api";
import type { ImportProgress, ImportSummary } from "../lib/types";
import { useToast } from "../components/useToast";
import { useI18n } from "../i18n/useI18n";
import { IconFolder, IconFile, IconUpload } from "../components/icons";
import { fileName } from "../lib/format";

export function ImportScreen({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const unlisten = useRef<null | (() => void)>(null);
  const toast = useToast();

  // Subscribe to backend import progress events (Tauri only).
  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      const un = await listen<ImportProgress>("import-progress", (e) => {
        if (active) setProgress(e.payload);
      });
      unlisten.current = un;
    })();
    return () => {
      active = false;
      unlisten.current?.();
    };
  }, []);

  const runImport = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) return;
      setBusy(true);
      setSummary(null);
      setProgress(null);
      try {
        const result = await importPaths(paths);
        setSummary(result);
        if (result.failed.length === 0) {
          toast.push(
            t("import.doneAll", {
              processed: result.processed,
              found: result.found,
            }),
            "success",
          );
        } else {
          toast.push(
            t("import.donePartial", {
              processed: result.processed,
              failed: result.failed.length,
            }),
            "info",
          );
        }
      } catch (e) {
        toast.push(t("import.failedToast", { error: String(e) }), "error");
      } finally {
        setBusy(false);
      }
    },
    [toast, t],
  );

  async function pickFiles() {
    if (!isTauri()) {
      // Browser demo: simulate a selection.
      return runImport([
        "/demo/resumes/candidate_a.pdf",
        "/demo/resumes/candidate_b.docx",
        "/demo/resumes/broken_file.pdf",
      ]);
    }
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      multiple: true,
      filters: [{ name: t("import.fileFilter"), extensions: ["pdf", "docx", "txt"] }],
    });
    if (selected)
      runImport(Array.isArray(selected) ? selected : [selected]);
  }

  async function pickFolder() {
    if (!isTauri()) {
      return runImport(["/demo/resumes"]);
    }
    const { open } = await import("@tauri-apps/plugin-dialog");
    const dir = await open({ directory: true });
    if (dir) runImport([dir as string]);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    // In a real Tauri build, file drops arrive via the webview drag event with
    // absolute paths exposed on the drop payload.
    const paths: string[] = [];
    for (const file of Array.from(e.dataTransfer.files)) {
      const withPath = file as File & { path?: string };
      if (withPath.path) paths.push(withPath.path);
    }
    if (paths.length > 0) {
      runImport(paths);
    } else if (!isTauri()) {
      runImport(["/demo/resumes/dropped_resume.pdf"]);
    } else {
      toast.push(t("import.noPaths"), "error");
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>{t("import.title")}</h2>
          <p>{t("import.subtitle")}</p>
        </div>
        <button className="btn ghost" onClick={onDone}>
          {t("import.back")}
        </button>
      </div>

      <div
        className={`dropzone ${dragging ? "drag" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <div style={{ fontSize: 34, marginBottom: 10 }}>
          <IconUpload size={34} />
        </div>
        <h3 style={{ margin: "0 0 4px" }}>{t("import.dropTitle")}</h3>
        <p style={{ margin: "0 0 18px" }}>{t("import.dropHint")}</p>
        <div className="row" style={{ justifyContent: "center" }}>
          <button className="btn" onClick={pickFiles} disabled={busy}>
            <IconFile size={16} /> {t("import.chooseFiles")}
          </button>
          <button className="btn" onClick={pickFolder} disabled={busy}>
            <IconFolder size={16} /> {t("import.chooseFolder")}
          </button>
        </div>
      </div>

      {busy && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="row" style={{ marginBottom: 10, justifyContent: "space-between" }}>
            <div className="row">
              <div className="spinner" />
              <strong>{t("import.processing")}</strong>
            </div>
            {progress && progress.found > 0 && (
              <span style={{ color: "var(--text-dim)", fontSize: 13 }}>
                {progress.processed} / {progress.found}
              </span>
            )}
          </div>
          <div className="progress">
            <div
              style={{
                width: progress && progress.found > 0
                  ? `${Math.round((progress.processed / progress.found) * 100)}%`
                  : "40%",
              }}
            />
          </div>
          <p style={{ color: "var(--text-faint)", fontSize: 12, marginTop: 8 }}>
            {progress?.current_file
              ? t("import.extractingFile", { file: fileName(progress.current_file) })
              : t("import.extracting")}
          </p>
        </div>
      )}

      {summary && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="stat-grid">
            <div className="stat">
              <div className="num">{summary.found}</div>
              <div className="lbl">{t("import.found")}</div>
            </div>
            <div className="stat">
              <div className="num" style={{ color: "var(--good)" }}>
                {summary.processed}
              </div>
              <div className="lbl">{t("import.processed")}</div>
            </div>
            <div className="stat">
              <div
                className="num"
                style={{
                  color: summary.failed.length ? "var(--bad)" : "var(--text)",
                }}
              >
                {summary.failed.length}
              </div>
              <div className="lbl">{t("import.failed")}</div>
            </div>
          </div>

          {summary.failed.length > 0 && (
            <div className="error-list">
              {summary.failed.map((f, i) => (
                <div className="err-row" key={i}>
                  <span className="fname">{fileName(f.file)}</span>
                  <span className="emsg">{f.error}</span>
                </div>
              ))}
            </div>
          )}

          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn primary" onClick={onDone}>
              {t("import.viewCandidates")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
