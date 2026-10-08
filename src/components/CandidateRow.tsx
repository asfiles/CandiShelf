import type { ReactNode } from "react";
import type { CandidateSummary } from "../lib/types";
import { initials } from "../lib/format";
import { experienceLabel } from "../i18n/format";
import { useI18n } from "../i18n/useI18n";
import { IconMapPin, IconBriefcase, IconStar } from "./icons";

export function CandidateRow({
  candidate,
  onOpen,
  children,
}: {
  candidate: CandidateSummary;
  onOpen: () => void;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <button className="candidate-row" onClick={onOpen}>
      <div className="avatar">{initials(candidate.name)}</div>
      <div className="candidate-main">
        <div className="name-line">
          <h3>{candidate.name}</h3>
          {candidate.in_shortlist && (
            <span className="badge star">
              <IconStar size={10} filled /> {t("row.shortlist")}
            </span>
          )}
          {candidate.has_duplicates && (
            <span className="badge dup" title={t("row.duplicateTitle")}>
              {t("row.duplicate")}
            </span>
          )}
        </div>
        <div className="title">
          {candidate.last_title ?? t("common.unknownRole")}
        </div>
        <div className="meta">
          {candidate.location && (
            <span>
              <IconMapPin size={13} /> {candidate.location}
            </span>
          )}
          <span>
            <IconBriefcase size={13} />{" "}
            {experienceLabel(candidate.experience_years, t)}
          </span>
        </div>
        {candidate.skills.length > 0 && (
          <div className="chips">
            {candidate.skills.slice(0, 6).map((s) => (
              <span className="chip" key={s}>
                {s}
              </span>
            ))}
            {candidate.skills.length > 6 && (
              <span className="chip">+{candidate.skills.length - 6}</span>
            )}
          </div>
        )}
      </div>
      {children}
    </button>
  );
}
