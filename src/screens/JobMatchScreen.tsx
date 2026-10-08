import { useState } from "react";
import { matchJob } from "../lib/api";
import type { JobMatchResponse } from "../lib/types";
import { CandidateRow } from "../components/CandidateRow";
import { CandidateDrawer } from "./CandidateDrawer";
import { useToast } from "../components/useToast";
import { useI18n } from "../i18n/useI18n";
import { scorePercent } from "../lib/format";
import { IconTarget } from "../components/icons";

export function JobMatchScreen() {
  const { t } = useI18n();
  const [jobText, setJobText] = useState("");
  const [response, setResponse] = useState<JobMatchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const toast = useToast();

  async function run() {
    if (!jobText.trim()) {
      toast.push(t("match.needText"), "info");
      return;
    }
    setLoading(true);
    try {
      const r = await matchJob(jobText);
      setResponse(r);
    } catch (e) {
      toast.push(t("match.failed", { error: String(e) }), "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>{t("match.title")}</h2>
          <p>{t("match.subtitle")}</p>
        </div>
      </div>

      <label className="field">
        <span>{t("match.jobLabel")}</span>
        <textarea
          className="textarea"
          style={{ minHeight: 160 }}
          placeholder={t("match.jobPlaceholder")}
          value={jobText}
          onChange={(e) => setJobText(e.target.value)}
        />
      </label>
      <div className="row" style={{ marginBottom: 8 }}>
        <button className="btn primary" onClick={run} disabled={loading}>
          {loading ? (
            <>
              <span className="spinner" /> {t("match.analyse")}
            </>
          ) : (
            <>
              <IconTarget size={16} /> {t("match.find")}
            </>
          )}
        </button>
        <button className="btn ghost" onClick={() => setJobText(t("match.sampleText"))}>
          {t("match.sample")}
        </button>
      </div>

      {response && (
        <>
          <div className="section" style={{ marginTop: 24 }}>
            <h4>{t("match.requirements")}</h4>
            {response.requirements.length === 0 ? (
              <p style={{ color: "var(--text-faint)" }}>
                {t("match.noRequirements")}
              </p>
            ) : (
              <div className="chips">
                {response.requirements.map((r) => (
                  <span className="chip req" key={r.label}>
                    {r.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="section">
            <h4>{t("match.ranked")}</h4>
            <div className="candidate-list">
              {response.results.map((r) => (
                <div key={r.candidate.id}>
                  <CandidateRow
                    candidate={r.candidate}
                    onOpen={() => setOpenId(r.candidate.id)}
                  >
                    <div className="score-pill">
                      <span className="score-val">
                        {scorePercent(r.score)}%
                      </span>
                      <div className="score-bar">
                        <div style={{ width: `${scorePercent(r.score)}%` }} />
                      </div>
                    </div>
                  </CandidateRow>
                  <div style={{ padding: "8px 16px 0" }}>
                    {r.matched.length > 0 && (
                      <div className="chips">
                        {r.matched.map((m) => (
                          <span className="chip match" key={m}>
                            ✓ {m}
                          </span>
                        ))}
                      </div>
                    )}
                    {r.missing.length > 0 && (
                      <div className="chips" style={{ marginTop: 6 }}>
                        {r.missing.map((m) => (
                          <span className="chip miss" key={m}>
                            ✗ {m}
                          </span>
                        ))}
                      </div>
                    )}
                    {r.snippet && (
                      <div className="snippet">“{r.snippet}”</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {openId != null && (
        <CandidateDrawer
          id={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => run()}
        />
      )}
    </>
  );
}
