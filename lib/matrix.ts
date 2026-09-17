import {
  CORPORA,
  JURISDICTIONS,
  Jurisdiction,
  CorpusRow,
  streamExists,
  rowsForStream,
  scopeValues,
} from "./corpus";

export interface Verdict {
  tier: 1 | 2 | 3;
  stream: string | null;
  clause_id: string | null;
  rule_text: string | null;
  source_url: string | null;
  effective_date: string | null;
  fine_bracket: { min: number; max: number; currency: string } | null;
  exemptions: Array<{
    condition?: string;
    note?: string;
    applies_until?: string | null;
  }> | null;
  question?: string;
  guidance?: string;
}

export interface AdjudicationInput {
  jurisdiction: Jurisdiction;
  attributes: Record<string, unknown>;
  confidence: number;
  generator_class: string;
  rule_version: string;
}

const CONFIDENCE_CLARIFY_THRESHOLD = 0.8;

function rowToVerdict(row: CorpusRow): Verdict {
  return {
    tier: 1,
    stream: row.stream,
    clause_id: row.clause_id,
    rule_text: row.rule_text,
    source_url: row.source_url,
    effective_date: row.effective_date,
    fine_bracket: row.fine_bracket,
    exemptions: row.exemptions,
  };
}

function tier2Verdict(payload: {
  stream: string | null;
  question: string;
}): Verdict {
  return {
    tier: 2,
    stream: payload.stream,
    clause_id: null,
    rule_text: null,
    source_url: null,
    effective_date: null,
    fine_bracket: null,
    exemptions: null,
    question: payload.question,
  };
}

function tier3Verdict(stream: string | null): Verdict {
  return {
    tier: 3,
    stream,
    clause_id: null,
    rule_text: null,
    source_url: null,
    effective_date: null,
    fine_bracket: null,
    exemptions: null,
    guidance: "general guidance only; no fine asserted",
  };
}

export async function adjudicate(input: AdjudicationInput): Promise<Verdict> {
  const { jurisdiction, attributes, confidence } = input;
  const stream =
    typeof attributes["stream"] === "string"
      ? (attributes["stream"] as string)
      : undefined;
  const scope =
    typeof attributes["scope"] === "string"
      ? (attributes["scope"] as string)
      : undefined;

  if (!stream) {
    return tier2Verdict({
      stream: null,
      question: "What kind of waste is this? Which stream (wet/dry/sanitary/special-care, food, paper, recyclables, residual…) applies?",
    });
  }

  if (!streamExists(jurisdiction, stream)) {
    return tier3Verdict(stream);
  }

  if (Number.isFinite(confidence) && confidence < CONFIDENCE_CLARIFY_THRESHOLD) {
    return tier2Verdict({
      stream,
      question: `I’m not confident enough that this is ${stream} waste (confidence ${(
        confidence * 100
      ).toFixed(0)}%). Please confirm the material and condition before I apply the law.`,
    });
  }

  const candidates = rowsForStream(jurisdiction, stream);

  if (candidates.length === 1) {
    return rowToVerdict(candidates[0]);
  }

  const scopes = scopeValues(jurisdiction, stream);
  if (scope && scopes.includes(scope)) {
    const exact = candidates.find((r) => r.scope === scope);
    if (exact) return rowToVerdict(exact);
  }

  return tier2Verdict({
    stream,
    question: `Which source (scope) applies for ${stream} waste: ${scopes.join(" / ")}?`,
  });
}

export function supportedJurisdictions(): Jurisdiction[] {
  return JURISDICTIONS;
}

export function corpusRowCount(jurisdiction: Jurisdiction): number {
  return CORPORA[jurisdiction].length;
}