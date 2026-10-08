import { useEffect, useState } from "react";
import type { Candidate } from "../lib/types";
import {
  getCandidate,
  updateCandidate,
  deleteCandidate,
  reprocessCandidate,
  openOriginal,
  setShortlist,
} from "../lib/api";
import { Drawer, ConfirmDialog } from "../components/Modal";
import { useToast } from "../components/useToast";
import { useI18n } from "../i18n/useI18n";
import { experienceLabel } from "../i18n/format";
import { initials, fileName } from "../lib/format";
import {
  IconExternal,
  IconTrash,
  IconEdit,
  IconRefresh,
  IconStar,
  IconMail,
} from "../components/icons";

export function CandidateDrawer({
  id,
  onClose,
  onChanged,
}: {
  id: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Candidate | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toast = useToast();

  useEffect(() => {
    getCandidate(id).then((c) => {
      setCandidate(c);
      setDraft(c);
    });
  }, [id]);

  if (!candidate || !draft) {
    return (
      <Drawer title={<h2>{t("drawer.loading")}</h2>} onClose={onClose}>
        <div className="center-load">
          <div className="spinner" />
        </div>
      </Drawer>
    );
  }

  const view = editing ? draft : candidate;

  async function save() {
    if (!draft) return;
    try {
      const updated = await updateCandidate(draft);
      setCandidate(updated);
      setDraft(updated);
      setEditing(false);
      toast.push(t("drawer.tUpdated"), "success");
      onChanged();
    } catch (e) {
      toast.push(t("drawer.tUpdateFailed", { error: String(e) }), "error");
    }
  }

  async function doDelete() {
    try {
      await deleteCandidate(id);
      toast.push(t("drawer.tDeleted"), "success");
      onChanged();
      onClose();
    } catch (e) {
      toast.push(t("drawer.tDeleteFailed", { error: String(e) }), "error");
    }
  }

  async function doReprocess() {
    try {
      const updated = await reprocessCandidate(id);
      setCandidate(updated);
      setDraft(updated);
      toast.push(t("drawer.tReprocessed"), "success");
      onChanged();
    } catch (e) {
      toast.push(t("drawer.tReprocessFailed", { error: String(e) }), "error");
    }
  }

  async function toggleStar() {
    await setShortlist(id, !candidate!.in_shortlist);
    const next = { ...candidate!, in_shortlist: !candidate!.in_shortlist };
    setCandidate(next);
    setDraft(next);
    onChanged();
  }

  const editField = (key: keyof Candidate, value: string) =>
    setDraft({ ...draft, [key]: value } as Candidate);

  return (
    <Drawer
      title={
        <div className="row">
          <div className="avatar" style={{ width: 44, height: 44 }}>
            {initials(view.name)}
          </div>
          <div>
            {editing ? (
              <input
                className="input"
                value={draft.name}
                onChange={(e) => editField("name", e.target.value)}
              />
            ) : (
              <h2 style={{ margin: 0 }}>{view.name}</h2>
            )}
            <div style={{ color: "var(--text-dim)", fontSize: 13 }}>
              {view.last_title ?? t("common.unknownRole")}
            </div>
          </div>
        </div>
      }
      onClose={onClose}
      actions={
        <button
          className="btn ghost sm"
          onClick={toggleStar}
          title={t("drawer.toggleShortlist")}
        >
          <IconStar size={16} filled={candidate.in_shortlist} />
        </button>
      }
    >
      {candidate.duplicate_of.length > 0 && (
        <div
          className="reason"
          style={{ borderColor: "var(--warn)", marginBottom: 16 }}
        >
          {t("drawer.possibleDuplicate", {
            ids: candidate.duplicate_of.join(", #"),
          })}
        </div>
      )}

      <div className="row" style={{ marginBottom: 20, flexWrap: "wrap" }}>
        <button className="btn" onClick={() => openOriginal(id)}>
          <IconExternal size={15} /> {t("drawer.openOriginal")}
        </button>
        {editing ? (
          <>
            <button className="btn primary" onClick={save}>
              {t("drawer.save")}
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                setDraft(candidate);
                setEditing(false);
              }}
            >
              {t("common.cancel")}
            </button>
          </>
        ) : (
          <button className="btn" onClick={() => setEditing(true)}>
            <IconEdit size={15} /> {t("drawer.edit")}
          </button>
        )}
        <button className="btn" onClick={doReprocess}>
          <IconRefresh size={15} /> {t("drawer.reprocess")}
        </button>
        <button
          className="btn danger"
          onClick={() => setConfirmDelete(true)}
        >
          <IconTrash size={15} /> {t("drawer.delete")}
        </button>
      </div>

      <div className="section">
        <h4>{t("drawer.contact")}</h4>
        <dl className="kv">
          <dt>{t("drawer.email")}</dt>
          <dd>
            {editing ? (
              <input
                className="input"
                value={draft.email ?? ""}
                onChange={(e) => editField("email", e.target.value)}
              />
            ) : view.email ? (
              <a
                href={`mailto:${view.email}`}
                style={{ color: "var(--accent)" }}
              >
                <IconMail size={13} /> {view.email}
              </a>
            ) : (
              "—"
            )}
          </dd>
          <dt>{t("drawer.phone")}</dt>
          <dd>
            {editing ? (
              <input
                className="input"
                value={draft.phone ?? ""}
                onChange={(e) => editField("phone", e.target.value)}
              />
            ) : (
              view.phone ?? "—"
            )}
          </dd>
          <dt>{t("drawer.linkedin")}</dt>
          <dd>
            {editing ? (
              <input
                className="input"
                value={draft.linkedin ?? ""}
                onChange={(e) => editField("linkedin", e.target.value)}
              />
            ) : view.linkedin ? (
              <span style={{ wordBreak: "break-all" }}>{view.linkedin}</span>
            ) : (
              "—"
            )}
          </dd>
          <dt>{t("drawer.location")}</dt>
          <dd>
            {editing ? (
              <input
                className="input"
                value={draft.location ?? ""}
                onChange={(e) => editField("location", e.target.value)}
              />
            ) : (
              view.location ?? "—"
            )}
          </dd>
          <dt>{t("drawer.fieldExperience")}</dt>
          <dd>{experienceLabel(view.experience_years, t)}</dd>
        </dl>
      </div>

      <ListSection
        title={t("drawer.skills")}
        items={view.skills}
        editing={editing}
        onChange={(items) => setDraft({ ...draft, skills: items })}
      />
      <ListSection
        title={t("drawer.languages")}
        items={view.languages}
        editing={editing}
        onChange={(items) => setDraft({ ...draft, languages: items })}
      />
      <ListSection
        title={t("drawer.education")}
        items={view.education}
        editing={editing}
        onChange={(items) => setDraft({ ...draft, education: items })}
      />

      {view.experiences.length > 0 && (
        <div className="section">
          <h4>{t("drawer.workExperience")}</h4>
          {view.experiences.map((exp, i) => (
            <div key={i} className="card" style={{ marginBottom: 8 }}>
              <strong>{exp.title}</strong>
              <div style={{ color: "var(--text-dim)", fontSize: 13 }}>
                {exp.employer} · {exp.period}
              </div>
              {exp.description && (
                <div style={{ fontSize: 13, marginTop: 6 }}>
                  {exp.description}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="section">
        <h4>{t("drawer.sourceFile")}</h4>
        <div style={{ color: "var(--text-dim)", fontSize: 13 }}>
          {fileName(view.source_path)}
        </div>
      </div>

      <div className="section">
        <h4>{t("drawer.extractedText")}</h4>
        <div className="fulltext">{view.full_text || t("drawer.noText")}</div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={t("drawer.deleteTitle")}
          message={t("drawer.deleteMsg")}
          confirmLabel={t("drawer.deleteConfirm")}
          danger
          onConfirm={() => {
            setConfirmDelete(false);
            doDelete();
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </Drawer>
  );
}

function ListSection({
  title,
  items,
  editing,
  onChange,
}: {
  title: string;
  items: string[];
  editing: boolean;
  onChange: (items: string[]) => void;
}) {
  if (!editing && items.length === 0) return null;
  return (
    <div className="section">
      <h4>{title}</h4>
      {editing ? (
        <textarea
          className="textarea"
          style={{ minHeight: 70 }}
          value={items.join(", ")}
          onChange={(e) =>
            onChange(
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
        />
      ) : (
        <div className="chips">
          {items.map((s) => (
            <span className="chip" key={s}>
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
