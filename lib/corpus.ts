import { default as indiaRules } from "../data/jurisdictions/india/rules.json";
import { default as nycRules } from "../data/jurisdictions/nyc/rules.json";
import { default as englandRules } from "../data/jurisdictions/england/rules.json";

export type Jurisdiction = "india" | "nyc" | "england";

export interface CorpusRow {
  jurisdiction: Jurisdiction;
  clause_id: string;
  stream: string;
  source_url: string;
  effective_date: string;
  date_precision: "year" | "exact";
  scope: string;
  fine_bracket: { min: number; max: number; currency: string } | null;
  exemptions: Array<{
    condition?: string;
    note?: string;
    applies_until?: string | null;
  }> | null;
  verification_status: string;
  rule_text: string;
  citation_precision: string;
}

export interface CorpusFile {
  jurisdiction: Jurisdiction;
  corpus: string;
  source_urls: string[];
  streams: string[];
  rows: CorpusRow[];
}

function loadCorpus(file: string, raw: unknown): CorpusRow[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(
      `Unrecognized corpus file shape in ${file}: expected a single { jurisdiction, corpus, source_urls, streams, rows } object`
    );
  }
  const wrapped = raw as Partial<CorpusFile>;
  if (!Array.isArray(wrapped.rows)) {
    throw new Error(`Corpus file ${file} is missing a rows[] array`);
  }
  return wrapped.rows as CorpusRow[];
}

const indiaRaw = indiaRules as unknown;
const nycRaw = nycRules as unknown;
const englandRaw = englandRules as unknown;

export const CORPORA: Record<Jurisdiction, CorpusRow[]> = {
  india: loadCorpus("india/rules.json", indiaRaw),
  nyc: loadCorpus("nyc/rules.json", nycRaw),
  england: loadCorpus("england/rules.json", englandRaw),
};

export const JURISDICTIONS: Jurisdiction[] = ["india", "nyc", "england"];

export function streamsFor(jurisdiction: Jurisdiction): string[] {
  return Array.from(new Set(CORPORA[jurisdiction].map((r) => r.stream)));
}

export function rowCount(jurisdiction: Jurisdiction): number {
  return CORPORA[jurisdiction].length;
}

export function streamExists(jurisdiction: Jurisdiction, stream: string): boolean {
  return streamsFor(jurisdiction).includes(stream);
}

export function rowsForStream(
  jurisdiction: Jurisdiction,
  stream: string
): CorpusRow[] {
  return CORPORA[jurisdiction].filter((r) => r.stream === stream);
}

export function scopeValues(jurisdiction: Jurisdiction, stream: string): string[] {
  return Array.from(
    new Set(rowsForStream(jurisdiction, stream).map((r) => r.scope))
  );
}