import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import type {
  CandidateSummary,
  MatchKind,
  SearchFilters,
  SearchResult,
} from "../lib/types";
import {
  listCandidates,
  search as apiSearch,
  setShortlist,
  exportShortlistCsv,
} from "../lib/api";
import { CandidateRow } from "../components/CandidateRow";
import { CandidateDrawer } from "./CandidateDrawer";
import { useToast } from "../components/useToast";
import { useI18n } from "../i18n/useI18n";
import { scorePercent } from "../lib/format";
import {
  IconSearch,
  IconUpload,
  IconTarget,
  IconStar,
  IconDownload,
  IconFilter,
} from "../components/icons";

/** Split a comma-separated input into trimmed, non-empty terms. */
const csv = (s: string): string[] =>
  s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

export function HomeScreen({
  onImport,
  onMatch,
}: {
  onImport: () => void;
  onMatch: () => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [minExp, setMinExp] = useState("");
  const [maxExp, setMaxExp] = useState("");
  const [title, setTitle] = useState("");
  const [skillsAll, setSkillsAll] = useState("");
  const [skillsExclude, setSkillsExclude] = useState("");
  const [languages, setLanguages] = useState("");
  const [shortlistOnly, setShortlistOnly] = useState(false);
  const [excludeDups, setExcludeDups] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [candidates, setCandidates] = useState<CandidateSummary[]>([]);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const toast = useToast();

  const filters = useMemo<SearchFilters>(
    () => ({
      location: location.trim() || null,
      min_experience: minExp ? Number(minExp) : null,
      max_experience: maxExp ? Number(maxExp) : null,
      last_title: title.trim() || null,
      skills_all: csv(skillsAll),
      skills_any: [],
      skills_exclude: csv(skillsExclude),
      languages: csv(languages),
      in_shortlist_only: shortlistOnly,
      exclude_duplicates: excludeDups,
    }),
    [
      location,
      minExp,
      maxExp,
      title,
      skillsAll,
      skillsExclude,
      languages,
      shortlistOnly,
      excludeDups,
    ],
  );

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.location) n++;
    if (filters.min_experience != null || filters.max_experience != null) n++;
    if (filters.last_title) n++;
    if (filters.skills_all.length) n++;
    if (filters.skills_exclude.length) n++;
    if (filters.languages.length) n++;
    if (filters.in_shortlist_only) n++;
    if (filters.exclude_duplicates) n++;
    return n;
  }, [filters]);

  function clearFilters() {
    setLocation("");
    setMinExp("");
    setMaxExp("");
    setTitle("");
    setSkillsAll("");
    setSkillsExclude("");
    setLanguages("");
    setShortlistOnly(false);
    setExcludeDups(false);
  }

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listCandidates(filters);
      setCandidates(list);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      reload();
    }
  }, [query, reload]);

  async function runSearch() {
    if (!query.trim()) {
      setResults(null);
      return reload();
    }
    setLoading(true);
    try {
      const r = await apiSearch(query, filters);
      setResults(r);
    } catch (e) {
      toast.push(t("home.searchFailed", { error: String(e) }), "error");
    } finally {
      setLoading(false);
    }
  }

  async function toggleShortlist(c: CandidateSummary, e: MouseEvent) {
    e.stopPropagation();
    await setShortlist(c.id, !c.in_shortlist);
    if (results) {
      setResults(
        results.map((r) =>
          r.candidate.id === c.id
            ? { ...r, candidate: { ...r.candidate, in_shortlist: !c.in_shortlist } }
            : r,
        ),
      );
    }
    reload();
  }

  async function doExport() {
    try {
      const path = await exportShortlistCsv();
      toast.push(t("home.exported", { path }), "success");
    } catch (e) {
      toast.push(t("home.exportFailed", { error: String(e) }), "error");
    }
  }

  const shortlistCount = candidates.filter((c) => c.in_shortlist).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h2>{t("home.title")}</h2>
          <p>
            {t("home.count", { count: candidates.length })}
            {shortlistCount > 0 && ` · ${t("home.shortlisted", { count: shortlistCount })}`}
          </p>
        </div>
        <div className="row">
          {shortlistCount > 0 && (
            <button className="btn" onClick={doExport}>
              <IconDownload size={16} /> {t("home.exportShortlist")}
            </button>
          )}
          <button className="btn" onClick={onMatch}>
            <IconTarget size={16} /> {t("home.matchToJob")}
          </button>
          <button className="btn primary" onClick={onImport}>
            <IconUpload size={16} /> {t("home.addResumes")}
          </button>
        </div>
      </div>

      <div className="searchbar">
        <div className="search-input-wrap">
          <span className="search-icon">
            <IconSearch size={16} />
          </span>
          <input
            className="input"
            placeholder={t("home.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
          />
        </div>
        <button className="btn primary" onClick={runSearch}>
          {t("home.search")}
        </button>
      </div>

      <div className="filters">
        <input
          className="input"
          placeholder={t("home.filterLocation")}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <select
          className="select"
          value={minExp}
          onChange={(e) => setMinExp(e.target.value)}
        >
          <option value="">{t("home.anyExperience")}</option>
          {[1, 3, 5, 8].map((n) => (
            <option key={n} value={String(n)}>
              {t("home.minYears", { count: n })}
            </option>
          ))}
        </select>
        <button
          className={"btn" + (showFilters || activeFilterCount > 0 ? " primary" : "")}
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
        >
          <IconFilter size={16} />{" "}
          {t("home.filters", { count: activeFilterCount })}
        </button>
        {activeFilterCount > 0 && (
          <button className="btn ghost" onClick={clearFilters}>
            {t("home.clearFilters")}
          </button>
        )}
      </div>

      {showFilters && (
        <div className="filters-advanced">
          <input
            className="input"
            placeholder={t("home.filterTitle")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className="input"
            placeholder={t("home.filterSkillsAll")}
            value={skillsAll}
            onChange={(e) => setSkillsAll(e.target.value)}
          />
          <input
            className="input"
            placeholder={t("home.filterSkillsExclude")}
            value={skillsExclude}
            onChange={(e) => setSkillsExclude(e.target.value)}
          />
          <input
            className="input"
            placeholder={t("home.filterLanguages")}
            value={languages}
            onChange={(e) => setLanguages(e.target.value)}
          />
          <select
            className="select"
            value={maxExp}
            onChange={(e) => setMaxExp(e.target.value)}
          >
            <option value="">{t("home.anyMax")}</option>
            {[3, 5, 8, 12].map((n) => (
              <option key={n} value={String(n)}>
                {t("home.maxYears", { count: n })}
              </option>
            ))}
          </select>
          <div className="filter-checks">
            <label>
              <input
                type="checkbox"
                checked={shortlistOnly}
                onChange={(e) => setShortlistOnly(e.target.checked)}
              />
              {t("home.filterShortlistOnly")}
            </label>
            <label>
              <input
                type="checkbox"
                checked={excludeDups}
                onChange={(e) => setExcludeDups(e.target.checked)}
              />
              {t("home.filterExcludeDuplicates")}
            </label>
          </div>
        </div>
      )}

      {loading ? (
        <div className="center-load">
          <div className="spinner" /> {t("common.working")}
        </div>
      ) : results ? (
        <ResultList
          results={results}
          onOpen={setOpenId}
          onStar={toggleShortlist}
        />
      ) : candidates.length === 0 ? (
        <EmptyState onImport={onImport} />
      ) : (
        <div className="candidate-list">
          {candidates.map((c) => (
            <CandidateRow key={c.id} candidate={c} onOpen={() => setOpenId(c.id)}>
              <button
                className="btn ghost sm"
                title={t(c.in_shortlist ? "home.removeShortlist" : "home.addShortlist")}
                onClick={(e) => toggleShortlist(c, e)}
              >
                <IconStar size={16} filled={c.in_shortlist} />
              </button>
            </CandidateRow>
          ))}
        </div>
      )}

      {openId != null && (
        <CandidateDrawer
          id={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => {
            reload();
            if (query.trim()) runSearch();
          }}
        />
      )}
    </>
  );
}

function matchLabel(t: ReturnType<typeof useI18n>["t"], kind: MatchKind): string {
  switch (kind) {
    case "email":
      return t("search.match.email");
    case "phone":
      return t("search.match.phone");
    case "linkedin":
      return t("search.match.linkedin");
    case "name":
      return t("search.match.name");
    default:
      return t("search.match.semantic");
  }
}

function ResultList({
  results,
  onOpen,
  onStar,
}: {
  results: SearchResult[];
  onOpen: (id: number) => void;
  onStar: (c: CandidateSummary, e: MouseEvent) => void;
}) {
  const { t } = useI18n();
  if (results.length === 0) {
    return (
      <div className="empty">
        <div className="emoji">🔍</div>
        <h3>{t("home.noMatches")}</h3>
        <p>{t("home.noMatchesHint")}</p>
      </div>
    );
  }
  return (
    <div className="candidate-list">
      {results.map((r) => (
        <div key={r.candidate.id}>
          <CandidateRow
            candidate={r.candidate}
            onOpen={() => onOpen(r.candidate.id)}
          >
            {r.match_kind === "semantic" ? (
              <div className="score-pill">
                <span className="score-val">{scorePercent(r.score)}%</span>
                <div className="score-bar">
                  <div style={{ width: `${scorePercent(r.score)}%` }} />
                </div>
                <button
                  className="btn ghost sm"
                  onClick={(e) => onStar(r.candidate, e)}
                >
                  <IconStar size={15} filled={r.candidate.in_shortlist} />
                </button>
              </div>
            ) : (
              <div className="score-pill">
                <span className="badge ok">{matchLabel(t, r.match_kind)}</span>
                <button
                  className="btn ghost sm"
                  onClick={(e) => onStar(r.candidate, e)}
                >
                  <IconStar size={15} filled={r.candidate.in_shortlist} />
                </button>
              </div>
            )}
          </CandidateRow>
          <div style={{ padding: "0 16px" }}>
            {r.match_kind === "semantic" && (
              <div className="reason">{t("search.match.semantic")}</div>
            )}
            {r.snippet && <div className="snippet">“{r.snippet}”</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onImport }: { onImport: () => void }) {
  const { t } = useI18n();
  return (
    <div className="empty">
      <div className="emoji">📇</div>
      <h3>{t("home.emptyTitle")}</h3>
      <p>{t("home.emptyHint")}</p>
      <button
        className="btn primary"
        style={{ marginTop: 16 }}
        onClick={onImport}
      >
        <IconUpload size={16} /> {t("home.addResumes")}
      </button>
    </div>
  );
}
