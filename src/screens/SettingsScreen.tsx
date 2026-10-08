import { useEffect, useRef, useState } from "react";
import type { AppSettings, ModelInfo, ReindexProgress } from "../lib/types";
import {
  listModels,
  downloadModel,
  deleteModel,
  setActiveModel,
  modelChangeImpact,
  setDataDir,
  setCopyOriginals,
  clearDatabase,
  checkForUpdates,
} from "../lib/api";
import { isTauri } from "../lib/api";
import { ConfirmDialog } from "../components/Modal";
import { ManualModelInstall } from "../components/ManualModelInstall";
import { useToast } from "../components/useToast";
import { useI18n } from "../i18n/useI18n";
import { LANGS } from "../i18n/types";
import { modelLanguages, modelName, modelShortDesc } from "../i18n/models";
import { formatBytes, percent } from "../lib/format";
import { useDownloadProgress } from "../lib/useDownloadProgress";
import {
  IconFolder,
  IconDownload,
  IconTrash,
  IconRefresh,
} from "../components/icons";

export function SettingsScreen({
  settings,
  onChange,
}: {
  settings: AppSettings;
  onChange: () => Promise<unknown>;
}) {
  const { t, lang, setLang } = useI18n();
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState<{
    model: ModelInfo;
    impact: number;
    redownload: boolean;
  } | null>(null);
  const [reindex, setReindex] = useState<ReindexProgress | null>(null);
  const progress = useDownloadProgress();
  const reindexUnlisten = useRef<null | (() => void)>(null);
  const toast = useToast();

  useEffect(() => {
    listModels().then(setModels);
  }, []);

  // Stream re-embedding progress after a model change.
  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      const un = await listen<ReindexProgress>("reindex-progress", (e) => {
        if (!active) return;
        setReindex(e.payload);
        if (e.payload.done) setTimeout(() => active && setReindex(null), 600);
      });
      reindexUnlisten.current = un;
    })();
    return () => {
      active = false;
      reindexUnlisten.current?.();
    };
  }, []);

  async function chooseDir() {
    if (!isTauri()) {
      toast.push(t("settings.tDirPicker"), "info");
      return;
    }
    const { open } = await import("@tauri-apps/plugin-dialog");
    const dir = await open({ directory: true });
    if (dir) {
      await setDataDir(dir as string);
      await onChange();
      toast.push(t("settings.tDirUpdated"), "success");
    }
  }

  async function refresh() {
    setModels(await listModels());
    await onChange();
  }

  // Download a not-yet-downloaded model (becomes active, base re-embeds).
  async function download(m: ModelInfo) {
    setBusy(m.id);
    try {
      await downloadModel(m.id);
      toast.push(t("settings.tDownloaded", { name: modelName(m, lang) }), "success");
      await refresh();
    } catch (e) {
      toast.push(t("settings.tDownloadFailed", { error: String(e) }), "error");
    } finally {
      setBusy(null);
    }
  }

  // Ask for confirmation (showing the re-embedding impact) before switching
  // the active model or re-downloading one.
  async function askSwitch(m: ModelInfo, redownload: boolean) {
    try {
      const impact = await modelChangeImpact(m.id);
      setPendingSwitch({ model: m, impact, redownload });
    } catch {
      setPendingSwitch({ model: m, impact: 0, redownload });
    }
  }

  async function confirmSwitch() {
    if (!pendingSwitch) return;
    const { model, redownload } = pendingSwitch;
    setPendingSwitch(null);
    setBusy(model.id);
    try {
      if (redownload) {
        await deleteModel(model.id);
        await downloadModel(model.id);
        toast.push(t("settings.tRedownloaded", { name: modelName(model, lang) }), "success");
      } else {
        await setActiveModel(model.id);
        toast.push(t("settings.tSwitched", { name: modelName(model, lang) }), "success");
      }
      await refresh();
    } catch (e) {
      toast.push(t("settings.tOpFailed", { error: String(e) }), "error");
    } finally {
      setBusy(null);
    }
  }

  async function remove(m: ModelInfo) {
    setBusy(m.id);
    try {
      await deleteModel(m.id);
      toast.push(t("settings.tRemoved", { name: modelName(m, lang) }), "success");
      await refresh();
    } catch (e) {
      toast.push(t("settings.tOpFailed", { error: String(e) }), "error");
    } finally {
      setBusy(null);
    }
  }

  async function toggleCopy() {
    await setCopyOriginals(!settings.copy_originals);
    await onChange();
  }

  async function doClear() {
    setConfirmClear(false);
    try {
      await clearDatabase();
      await onChange();
      toast.push(t("settings.tCleared"), "success");
    } catch (e) {
      toast.push(t("settings.tClearFailed", { error: String(e) }), "error");
    }
  }

  async function updates() {
    try {
      await checkForUpdates();
      toast.push(t("settings.tUpdateMsg", { v: settings.version }), "info");
    } catch (e) {
      toast.push(t("settings.tUpdateFailed", { error: String(e) }), "error");
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>{t("settings.title")}</h2>
          <p>{t("settings.subtitle")}</p>
        </div>
      </div>

      <div className="section">
        <h4>{t("settings.language")}</h4>
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
            <span style={{ color: "var(--text-dim)", fontSize: 13 }}>
              {t("settings.languageHint")}
            </span>
            <div
              className="mode-toggle"
              role="group"
              aria-label={t("settings.language")}
            >
              {LANGS.map((l) => (
                <button
                  key={l}
                  className={lang === l ? "active" : ""}
                  aria-pressed={lang === l}
                  onClick={() => setLang(l)}
                >
                  {t(l === "en" ? "language.en" : "language.ru")}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <h4>{t("settings.dataDir")}</h4>
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "monospace", fontSize: 13, wordBreak: "break-all" }}>
                {settings.data_dir}
              </div>
              <div style={{ color: "var(--text-faint)", fontSize: 12, marginTop: 4 }}>
                {t("settings.dataDirHint")}
              </div>
            </div>
            <button className="btn" onClick={chooseDir}>
              <IconFolder size={16} /> {t("settings.change")}
            </button>
          </div>
          <label
            className="row"
            style={{ marginTop: 14, cursor: "pointer", gap: 8 }}
          >
            <input
              type="checkbox"
              checked={settings.copy_originals}
              onChange={toggleCopy}
            />
            <span>{t("settings.copyOriginals")}</span>
          </label>
        </div>
      </div>

      <div className="section">
        <h4>{t("settings.models")}</h4>
        <p style={{ color: "var(--text-faint)", fontSize: 12, marginTop: -4, marginBottom: 10 }}>
          {t("settings.modelsHint")}
        </p>
        <div className="card">
          {models.map((m) => (
            <div className="model-row" key={m.id}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="row" style={{ gap: 8 }}>
                  <strong>{modelName(m, lang)}</strong>
                  {m.recommended && <span className="badge star">{t("common.recommended")}</span>}
                  {m.active && <span className="badge star">{t("settings.active")}</span>}
                </div>
                <div style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 2 }}>
                  {modelShortDesc(m, lang)}
                </div>
                <div style={{ color: "var(--text-faint)", fontSize: 12, marginTop: 2 }}>
                  {modelLanguages(m, lang)} · {formatBytes(m.size_bytes)} ·{" "}
                  {t(m.downloaded ? "settings.downloaded" : "settings.notDownloaded")}
                </div>
                <div style={{ color: "var(--text-faint)", fontSize: 11, marginTop: 2, wordBreak: "break-all" }}>
                  {m.url}
                </div>
                <ManualModelInstall model={m} style={{ marginTop: 8 }} />
                {busy === m.id && progress && progress.total > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div className="progress">
                      <div style={{ width: `${percent(progress.downloaded, progress.total)}%` }} />
                    </div>
                    <div style={{ color: "var(--text-faint)", fontSize: 11, marginTop: 4 }}>
                      {formatBytes(progress.downloaded)} / {formatBytes(progress.total)}
                    </div>
                  </div>
                )}
              </div>
              <div className="row" style={{ gap: 8, flexShrink: 0 }}>
                {busy === m.id ? (
                  <span className="spinner" />
                ) : m.downloaded ? (
                  <>
                    {!m.active && (
                      <button className="btn primary sm" onClick={() => askSwitch(m, false)}>
                        {t("settings.use")}
                      </button>
                    )}
                    <button
                      className="btn sm"
                      title={t("settings.redownload")}
                      onClick={() => askSwitch(m, true)}
                    >
                      <IconRefresh size={15} />
                    </button>
                    <button
                      className="btn danger sm"
                      title={t("settings.remove")}
                      onClick={() => remove(m)}
                    >
                      <IconTrash size={15} />
                    </button>
                  </>
                ) : (
                  <button className="btn primary sm" onClick={() => download(m)}>
                    <IconDownload size={15} /> {t("settings.download")}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        {reindex && (
          <div className="card" style={{ marginTop: 10 }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <div className="row">
                <span className="spinner" />
                <strong>{t("settings.reembedding")}</strong>
              </div>
              <span style={{ color: "var(--text-dim)", fontSize: 13 }}>
                {reindex.processed} / {reindex.total}
              </span>
            </div>
            <div className="progress">
              <div style={{ width: `${percent(reindex.processed, reindex.total)}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="section">
        <h4>{t("settings.updates")}</h4>
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <div>
                {t("settings.version", { v: settings.version })}
              </div>
            </div>
            <button className="btn" onClick={updates}>
              <IconRefresh size={15} /> {t("settings.checkUpdates")}
            </button>
          </div>
        </div>
      </div>

      <div className="section">
        <h4>{t("settings.danger")}</h4>
        <div className="card" style={{ borderColor: "rgba(229,100,95,0.3)" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <strong>{t("settings.clearTitle")}</strong>
              <div style={{ color: "var(--text-dim)", fontSize: 13 }}>
                {t("settings.clearHint")}
              </div>
            </div>
            <button className="btn danger" onClick={() => setConfirmClear(true)}>
              <IconTrash size={15} /> {t("settings.clearButton")}
            </button>
          </div>
        </div>
      </div>

      {confirmClear && (
        <ConfirmDialog
          title={t("settings.clearConfirmTitle")}
          message={t("settings.clearConfirmMsg")}
          confirmLabel={t("settings.clearConfirmLabel")}
          danger
          onConfirm={doClear}
          onCancel={() => setConfirmClear(false)}
        />
      )}

      {pendingSwitch && (
        <ConfirmDialog
          title={
            pendingSwitch.redownload
              ? t("settings.reDownloadTitle", { name: modelName(pendingSwitch.model, lang) })
              : t("settings.switchTitle", { name: modelName(pendingSwitch.model, lang) })
          }
          message={
            <>
              {pendingSwitch.redownload
                ? t("settings.switchMsgRe")
                : t("settings.switchMsgActive")}
              {pendingSwitch.impact > 0
                ? ` ${t("settings.switchImpact", { count: pendingSwitch.impact })}`
                : ` ${t("settings.switchImpactNone")}`}
            </>
          }
          confirmLabel={
            pendingSwitch.redownload
              ? t("settings.reDownloadConfirm")
              : t("settings.switchConfirm")
          }
          onConfirm={confirmSwitch}
          onCancel={() => setPendingSwitch(null)}
        />
      )}
    </>
  );
}
