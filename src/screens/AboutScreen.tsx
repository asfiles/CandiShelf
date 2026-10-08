import { useEffect, useState } from "react";
import { getAppInfo, openExternal } from "../lib/api";
import type { AppInfo } from "../lib/types";
import {
  IconGithub,
  IconExternal,
  IconShield,
  IconFile,
} from "../components/icons";
import { useToast } from "../components/useToast";
import { useI18n } from "../i18n/useI18n";

export function AboutScreen() {
  const { t } = useI18n();
  const [info, setInfo] = useState<AppInfo | null>(null);
  const toast = useToast();

  useEffect(() => {
    getAppInfo()
      .then(setInfo)
      .catch((e) => toast.push(t("about.infoFailed", { error: String(e) }), "error"));
  }, [toast, t]);

  async function open(url: string) {
    try {
      await openExternal(url);
    } catch (e) {
      toast.push(t("about.openFailed", { error: String(e) }), "error");
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>{t("about.title")}</h2>
          <p>{t("about.subtitle")}</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="row" style={{ gap: 16 }}>
          <img
            src="/icon.png"
            alt="CandiShelf"
            style={{ width: 64, height: 64, borderRadius: 14 }}
          />
          <div style={{ flex: 1 }}>
            <div className="row" style={{ gap: 10 }}>
              <h2 style={{ margin: 0 }}>{info?.name ?? "CandiShelf"}</h2>
              {info && <span className="badge star">{info.tag}</span>}
            </div>
            <div style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 2 }}>
              {t("about.tagline")}
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <h4>{t("about.details")}</h4>
        <div className="card">
          <dl className="kv">
            <dt>{t("about.version")}</dt>
            <dd>
              <strong>{info ? info.tag : "…"}</strong>
              {info && (
                <span style={{ color: "var(--text-faint)" }}>
                  {" "}
                  {t("about.build", { v: info.version })}
                </span>
              )}
            </dd>
            <dt>{t("about.author")}</dt>
            <dd>
              {info ? (
                <button
                  className="btn ghost sm"
                  style={{ padding: 0 }}
                  onClick={() => open(info.author_url)}
                >
                  <IconGithub size={15} /> {info.author}
                  <IconExternal size={12} />
                </button>
              ) : (
                "…"
              )}
            </dd>
            <dt>{t("about.homepage")}</dt>
            <dd>
              {info ? (
                <button
                  className="btn ghost sm"
                  style={{ padding: 0 }}
                  onClick={() => open(info.homepage)}
                >
                  {info.homepage}
                  <IconExternal size={12} />
                </button>
              ) : (
                "…"
              )}
            </dd>
            <dt>{t("about.license")}</dt>
            <dd>{info?.license ?? "…"}</dd>
          </dl>
        </div>
      </div>

      <div className="section">
        <h4>{t("about.privacy")}</h4>
        <div className="card">
          <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
            <span style={{ color: "var(--good)" }}>
              <IconShield size={18} />
            </span>
            <div>
              <div>{t("about.privacy1")}</div>
              <div
                style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 6 }}
              >
                {t("about.privacy2")}
              </div>
              <div
                style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 6 }}
              >
                {t("about.privacy3")}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <h4>{t("about.data")}</h4>
        <div className="card">
          <div className="row" style={{ gap: 10 }}>
            <IconFile size={16} />
            <span style={{ color: "var(--text-dim)", fontSize: 13 }}>
              {t("about.dataText")}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
