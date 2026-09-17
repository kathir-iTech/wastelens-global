import { CORPORA, CorpusRow, Jurisdiction } from "./corpus";

export interface RetrievalResult {
  clause_id: string;
  rule_text: string;
  source_url: string;
  effective_date: string;
  jurisdiction: Jurisdiction;
  scope: string;
  stream: string;
  fine_bracket: CorpusRow["fine_bracket"];
  exemptions: CorpusRow["exemptions"];
  score: number;
}

function scoreRow(row: CorpusRow, attributes: Record<string, unknown>): number {
  const stream =
    typeof attributes["stream"] === "string" ? attributes["stream"] : "";
  const scope =
    typeof attributes["scope"] === "string" ? attributes["scope"] : "";
  const object =
    typeof attributes["object_class"] === "string"
      ? attributes["object_class"]
      : "";
  const material =
    typeof attributes["material_surface"] === "string"
      ? attributes["material_surface"]
      : "";

  let score = 0;
  if (stream && row.stream === stream) score += 40;
  if (scope && row.scope === scope) score += 25;
  const text = `${row.rule_text} ${row.clause_id} ${row.stream}`.toLowerCase();
  for (const term of [object, material].filter(Boolean)) {
    if (text.includes(term.toLowerCase())) score += 10;
  }
  const words = `${object} ${material}`
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 3);
  for (const w of words) {
    if (text.includes(w)) score += 2;
  }
  return score;
}

export async function retrieve(
  attributes: Record<string, unknown>,
  jurisdiction: Jurisdiction
): Promise<RetrievalResult[]> {
  const rows = CORPORA[jurisdiction]
    .map((row) => ({
      clause_id: row.clause_id,
      rule_text: row.rule_text,
      source_url: row.source_url,
      effective_date: row.effective_date,
      jurisdiction: row.jurisdiction,
      scope: row.scope,
      stream: row.stream,
      fine_bracket: row.fine_bracket,
      exemptions: row.exemptions,
      score: scoreRow(row, attributes),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  return rows;
}

export async function retrieveRemote(
  _attributes: Record<string, unknown>,
  _jurisdiction: Jurisdiction
): Promise<RetrievalResult[]> {
  throw new Error(
    "pgvector remote retrieval is not wired in this build; using local corpus only (Mode B)."
  );
}