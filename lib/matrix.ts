// Deterministic adjudicator.
// Same input + same jurisdiction + same rule version -> same output.
// Never a classifier. Always a lookup + rule application.

export interface Verdict {
  stream: string;
  clause_id: string;
  source_url: string;
  effective_date: string;
  fine_bracket: { min: number; max: number; currency: string } | null;
  tier: 1 | 2 | 3;
  exemptions: Array<{ condition: string; applies_until: string | null }> | null;
}

export interface AdjudicationInput {
  jurisdiction: "india" | "nyc" | "england";
  attributes: Record<string, unknown>;
  confidence: number;
  generator_class: string;
  rule_version: string;
}

export async function adjudicate(input: AdjudicationInput): Promise<Verdict> {
  // TODO: implement lookup against jurisdiction-specific corpus
  // This function MUST be deterministic given the same input.
  throw new Error("Not implemented — to be built in session");
}
