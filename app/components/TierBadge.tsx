import { CircleCheck, CircleHelp, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

export type Tier = 1 | 2 | 3;

const TIER_TEXT: Record<Tier, string> = {
  1: "text-tier1",
  2: "text-tier2",
  3: "text-tier3",
};

const TIER_LABELS: Record<Tier, string> = {
  1: "Confirmed",
  2: "Clarify",
  3: "Coverage gap",
};

function TierIcon({ tier }: { tier: Tier }) {
  if (tier === 1) return <CircleCheck className="h-4 w-4" aria-hidden="true" />;
  if (tier === 2) return <CircleHelp className="h-4 w-4" aria-hidden="true" />;
  return <TriangleAlert className="h-4 w-4" aria-hidden="true" />;
}

export function TierBadge({ tier }: { tier: Tier }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm font-semibold", TIER_TEXT[tier])}>
      <TierIcon tier={tier} />
      {TIER_LABELS[tier]}
    </span>
  );
}

export function TierExplanation({ tier }: { tier: Tier }) {
  if (tier === 1) {
    return (
      <p className="mt-2 text-sm text-muted">
        Confirmed against a verified corpus row — the rule text below is applied as-is.
      </p>
    );
  }
  if (tier === 2) {
    return (
      <p className="mt-2 text-sm text-tier2">
        Not confident enough to apply the law. One clarifying answer re-runs the matrix
        without a new photograph.
      </p>
    );
  }
  return (
    <p className="mt-2 text-sm text-tier3">
      Coverage gap: no verified corpus row matches this in this jurisdiction. No fine is
      asserted; general guidance only.
    </p>
  );
}