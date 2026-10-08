import { describe, expect, it } from "vitest";
import { mockBackend } from "./mockBackend";
import type { CandidateSummary, SearchFilters, SearchResult } from "./types";

/** An empty filter set; individual tests override the fields they exercise. */
const base: SearchFilters = {
  location: null,
  min_experience: null,
  max_experience: null,
  last_title: null,
  skills_all: [],
  skills_any: [],
  skills_exclude: [],
  languages: [],
  in_shortlist_only: false,
  exclude_duplicates: false,
};

const search = (query: string, over: Partial<SearchFilters> = {}) =>
  mockBackend<SearchResult[]>("search", { query, filters: { ...base, ...over } });

const list = (over: Partial<SearchFilters> = {}) =>
  mockBackend<CandidateSummary[]>("list_candidates", {
    filters: { ...base, ...over },
  });

describe("mock hybrid search", () => {
  it("matches an e-mail exactly, case-insensitively", async () => {
    const r = await search("ADA.KOVACS@EXAMPLE.COM");
    expect(r).toHaveLength(1);
    expect(r[0].candidate.name).toBe("Ada Kovács");
    expect(r[0].match_kind).toBe("email");
  });

  it("matches a name regardless of token order", async () => {
    const r = await search("wei chen");
    expect(r.some((x) => x.candidate.name === "Chen Wei")).toBe(true);
    expect(r[0].match_kind).toBe("name");
  });

  it("applies filters to literal (contact) hits", async () => {
    const r = await search("ada.kovacs@example.com", {
      skills_exclude: ["Kubernetes"],
    });
    expect(r).toHaveLength(0);
  });

  it("falls back to semantic for descriptive queries", async () => {
    const r = await search("Kubernetes");
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((x) => x.match_kind === "semantic")).toBe(true);
  });
});

describe("mock filters", () => {
  it("filters the list by required skills and languages", async () => {
    const rows = await list({ skills_all: ["AWS"], languages: ["English"] });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((c) => c.skills.includes("AWS"))).toBe(true);
    expect(rows.every((c) => c.languages.includes("English"))).toBe(true);
  });

  it("excludes candidates by skill", async () => {
    const rows = await list({ skills_exclude: ["AWS"] });
    expect(rows.every((c) => !c.skills.includes("AWS"))).toBe(true);
  });
});
