import { useEffect, useState } from "react";
import {
  listModels,
  downloadModel,
  setActiveModel,
} from "../lib/api";
import type { ModelInfo } from "../lib/types";
import { formatBytes, percent } from "../lib/format";
import { IconDownload } from "../components/icons";
import { ManualModelInstall } from "../components/ManualModelInstall";
import { useToast } from "../components/useToast";
import { useI18n } from "../i18n/useI18n";
import { LANGS } from "../i18n/types";
import { modelName, modelShortDesc } from "../i18n/models";
import { useDownloadProgress } from "../lib/useDownloadProgress";

export function FirstRunGate({ onReady }: { onReady: () => Promise<unknown> }) {
  const { t, lang, setLang } = useI18n();
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const progress = useDownloadProgress();
  const toast = useToast();

  useEffect(() => {
    listModels().then((m) => {
      setModels(m);
      setSelected((cur) => cur ?? m.find((x) => x.recommended)?.id ?? m[0]?.id ?? null);
    });
  }, []);

  async function handleConfirm(id: string) {
    const model = models.find((m) => m.id === id);
    const alreadyInstalled = model?.downloaded ?? false;
    setBusy(id);
    try {
      // A model whose files are already on disk needs no download — just make it
      // active.
      if (alreadyInstalled) {
        await setActiveModel(id);
        toast.push(t("firstrun.tActivated"), "success");
      } else {
        await downloadModel(id);
        toast.push(t("firstrun.tDownloaded"), "success");
      }
      await onReady();
    } catch (e) {
      toast.push(
        t(alreadyInstalled ? "firstrun.tActivateFailed" : "firstrun.tDownloadFailed", {
          error: String(e),
        }),
        "error",
      );
    } finally {
      setBusy(null);
    }
  }

  const selectedModel = models.find((m) => m.id === selected) ?? null;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "56px 24px" }}>
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div className="brand" style={{ paddingLeft: 0 }}>
          <img src="/icon.png" alt="" style={{ width: 40, height: 40 }} />
          <div>
            <h1 style={{ fontSize: 24 }}>{t("firstrun.welcome")}</h1>
          </div>
        </div>
        <div
          className="mode-toggle"
          role="group"
          aria-label={t("firstrun.language")}
          style={{ flexShrink: 0, marginTop: 6 }}
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
      <p style={{ color: "var(--text-dim)", marginTop: 4 }}>
        {t("firstrun.intro")}
      </p>

      <h4 style={{ color: "var(--text-faint)", marginTop: 28, marginBottom: 10 }}>
        {t("firstrun.chooseModel")}
      </h4>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {models.map((m) => (
          <ModelChoice
            key={m.id}
            model={m}
            selected={selected === m.id}
            disabled={busy !== null}
            onSelect={() => setSelected(m.id)}
          />
        ))}
      </div>

      {busy && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <div className="row">
              <span className="spinner" />
              <strong>{t("firstrun.downloadingVerify")}</strong>
            </div>
            {progress && progress.total > 0 && (
              <span style={{ color: "var(--text-dim)", fontSize: 13 }}>
                {formatBytes(progress.downloaded)} / {formatBytes(progress.total)}
              </span>
            )}
          </div>
          <div className="progress">
            <div
              style={{
                width: progress && progress.total > 0
                  ? `${percent(progress.downloaded, progress.total)}%`
                  : "40%",
              }}
            />
          </div>
          {progress?.file_name && (
            <p style={{ color: "var(--text-faint)", fontSize: 12, marginTop: 8 }}>
              {progress.file_name} ({progress.file_index + 1}/{progress.file_count})
            </p>
          )}
        </div>
      )}

      <button
        className="btn primary"
        style={{ marginTop: 18, width: "100%", justifyContent: "center" }}
        disabled={busy !== null || !selected}
        onClick={() => selected && handleConfirm(selected)}
      >
        {busy ? (
          <>{t("firstrun.downloading")}</>
        ) : selectedModel?.downloaded ? (
          <>{t("firstrun.useSelected")}</>
        ) : (
          <>
            <IconDownload size={16} /> {t("firstrun.downloadSelected")}
          </>
        )}
      </button>

      {selectedModel && (
        <ManualModelInstall
          model={selectedModel}
          className="card"
          style={{ marginTop: 16 }}
        />
      )}

      <p style={{ color: "var(--text-faint)", fontSize: 12, marginTop: 16, textAlign: "center" }}>
        {t("firstrun.note")}
      </p>
    </div>
  );
}

function ModelChoice({
  model,
  selected,
  disabled,
  onSelect,
}: {
  model: ModelInfo;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const { t, lang } = useI18n();
  return (
    <button
      className="card"
      onClick={onSelect}
      disabled={disabled}
      style={{
        textAlign: "left",
        cursor: disabled ? "not-allowed" : "pointer",
        borderColor: selected ? "var(--accent)" : "var(--border)",
        boxShadow: selected ? "0 0 0 3px var(--accent-soft)" : "none",
      }}
    >
      <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
        <div className="row" style={{ gap: 10 }}>
          <span
            aria-hidden
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              border: "2px solid",
              borderColor: selected ? "var(--accent)" : "var(--border-strong)",
              background: selected
                ? "radial-gradient(circle, var(--accent) 0 4px, transparent 5px)"
                : "transparent",
              flexShrink: 0,
            }}
          />
          <strong>{modelName(model, lang)}</strong>
          {model.recommended && (
            <span className="badge star">{t("common.recommended")}</span>
          )}
          {model.downloaded && (
            <span className="badge ok">{t("firstrun.available")}</span>
          )}
        </div>
        <span style={{ color: "var(--text-faint)", whiteSpace: "nowrap" }}>
          {formatBytes(model.size_bytes)}
        </span>
      </div>
      <div style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 8, marginLeft: 26 }}>
        {modelShortDesc(model, lang)}
      </div>
      <div style={{ color: "var(--text-faint)", fontSize: 11, marginTop: 6, marginLeft: 26, wordBreak: "break-all" }}>
        {model.url}
      </div>
    </button>
  );
}
