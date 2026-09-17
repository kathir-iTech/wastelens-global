import { adjudicate, AdjudicationInput, Verdict } from "./matrix";
import { Jurisdiction } from "./corpus";

export interface ModeBInput {
  jurisdiction: Jurisdiction;
  attributes: Record<string, unknown>;
  confidence: number;
  generator_class: string;
  rule_version: string;
}

export async function localVerdict(
  input: ModeBInput
): Promise<{ verdict: Verdict; used_network: boolean }> {
  const adjudication: AdjudicationInput = {
    jurisdiction: input.jurisdiction,
    attributes: input.attributes,
    confidence: input.confidence,
    generator_class: input.generator_class,
    rule_version: input.rule_version,
  };
  const verdict = await adjudicate(adjudication);
  return { verdict, used_network: false };
}