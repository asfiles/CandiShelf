/**
 * Collapsible hint explaining how to install a model by hand, without the app
 * downloading anything: it shows the exact target folder and the files to place
 * there. Shared by the first-run screen and Settings → AI models.
 */
import type { CSSProperties } from "react";
import type { ModelInfo } from "../lib/types";
import { openExternal } from "../lib/api";
import { useI18n } from "../i18n/useI18n";

export function ManualModelInstall({
  model,
  className,
  style,
}: {
  model: ModelInfo;
  className?: string;
  style?: CSSProperties;
}) {
  const { t } = useI18n();
  return (
    <details className={className} style={style}>
      <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
        {t("model.manualTitle")}
      </summary>
      <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 10 }}>
        {t("model.manualHint")}
      </p>
      {model.downloaded && (
        <p style={{ color: "var(--good)", fontSize: 13, marginTop: 4 }}>
          {t("model.manualDetected")}
        </p>
      )}
      <div style={{ marginTop: 10 }}>
        <div style={{ color: "var(--text-faint)", fontSize: 12 }}>
          {t("model.manualFolder")}
        </div>
        <code
          style={{
            display: "block",
            fontSize: 12,
            marginTop: 4,
            color: "var(--text-dim)",
            wordBreak: "break-all",
          }}
        >
          {model.dir}
        </code>
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ color: "var(--text-faint)", fontSize: 12 }}>
          {t("model.manualFiles")}
        </div>
        <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
          {model.files.map((f) => (
            <li key={f.name} style={{ fontSize: 12, marginTop: 2 }}>
              <a
                href={f.url}
                onClick={(e) => {
                  e.preventDefault();
                  void openExternal(f.url);
                }}
                style={{ color: "var(--accent)", wordBreak: "break-all" }}
              >
                {f.name}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
