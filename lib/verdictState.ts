import { JURISDICTIONS, Jurisdiction } from "./corpus";
import { adjudicate, AdjudicationInput, Verdict } from "./matrix";
import { PerceptionOutput } from "./perception";
import { mapPerceptionToAttributes } from "./attributeMapper";

export interface PerceptionOutcome {
  output: PerceptionOutput | null;
  model_id: string | null;
  error?: string;
}

export interface VerdictState {
  imageRef: string | null;
  perception: PerceptionOutcome | null;
  perceiveInvocations: number;
  verdicts: Partial<Record<Jurisdiction, Verdict>>;
  verdictImageRef: string | null;
}

export function freshVerdictState(): VerdictState {
  return {
    imageRef: null,
    perception: null,
    perceiveInvocations: 0,
    verdicts: {},
    verdictImageRef: null,
  };
}

export type PerceiveFn = (imageRef: string) => Promise<PerceptionOutcome>;

export interface VerdictController {
  getState: () => VerdictState;
  perceiveImage: (imageRef: string) => Promise<VerdictState>;
  selectJurisdiction: (jurisdiction: Jurisdiction, scope: string) => Promise<VerdictState>;
  answerClarify: (jurisdiction: Jurisdiction, scope: string, answer: Record<string, unknown>) => Promise<VerdictState>;
}

export function createVerdictController(
  perceiveFn: PerceiveFn
): VerdictController {
  let state = freshVerdictState();

  async function perceiveImage(imageRef: string): Promise<VerdictState> {
    if (state.imageRef === imageRef && state.perception) {
      return state;
    }
    const perception = await perceiveFn(imageRef);
    state = {
      imageRef,
      perception,
      perceiveInvocations: state.perceiveInvocations + 1,
      verdicts: {},
      verdictImageRef: null,
    };
    return state;
  }

  async function selectJurisdiction(
    jurisdiction: Jurisdiction,
    scope: string
  ): Promise<VerdictState> {
    if (!state.perception || !state.perception.output) return state;
    if (state.verdicts[jurisdiction] && state.verdictImageRef === state.imageRef) {
      return state;
    }
    const out = state.perception.output;
    const input: AdjudicationInput = {
      jurisdiction,
      attributes: mapPerceptionToAttributes(out, jurisdiction, scope),
      confidence: out.confidence,
      generator_class: "wastelens-v1",
      rule_version: "1.0",
    };
    const verdict = await adjudicate(input);
    state = {
      ...state,
      verdicts: { ...state.verdicts, [jurisdiction]: verdict },
      verdictImageRef: state.imageRef,
    };
    return state;
  }

  async function answerClarify(
    jurisdiction: Jurisdiction,
    scope: string,
    answer: Record<string, unknown>
  ): Promise<VerdictState> {
    if (!state.perception || !state.perception.output) return state;
    const out = state.perception.output;
    const base = mapPerceptionToAttributes(out, jurisdiction, scope);
    const input: AdjudicationInput = {
      jurisdiction,
      attributes: { ...base, ...answer },
      confidence: out.confidence,
      generator_class: "wastelens-v1",
      rule_version: "1.0",
    };
    const verdict = await adjudicate(input);
    state = {
      ...state,
      verdicts: { ...state.verdicts, [jurisdiction]: verdict },
      verdictImageRef: state.imageRef,
    };
    return state;
  }

  return {
    getState: () => state,
    perceiveImage,
    selectJurisdiction,
    answerClarify,
  };
}

export const JURISDICTION_LABELS: Record<Jurisdiction, string> = {
  india: "India (SWM 2026)",
  nyc: "New York City (LL 19 of 1989, §16-301 et seq.)",
  england: "England (SI 2025/140)",
};

export function orderedJurisdictions(): Jurisdiction[] {
  return JURISDICTIONS;
}