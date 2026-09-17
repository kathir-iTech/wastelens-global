import { cn } from "@/lib/cn";

const TIER_STYLES: Record<1 | 2 | 3, string> = {
  1: "border-emerald-200 bg-emerald-50 text-emerald-800",
  2: "border-amber-200 bg-amber-50 text-amber-800",
  3: "border-rose-200 bg-rose-50 text-rose-800",
};

const TIER_LABELS: Record<1 | 2 | 3, string> = {
  1: "Tier 1 · Confident",
  2: "Tier 2 · Clarify",
  3: "Tier 3 · Coverage gap",
};

export function TierBadge({ tier }: { tier: 1 | 2 | 3 }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        TIER_STYLES[tier]
      )}
    >
      {TIER_LABELS[tier]}
    </span>
  );
}

export function TierExplanation({ tier }: { tier: 1 | 2 | 3 }) {
  if (tier === 1) {
    return (
      <p className="text-xs text-slate-500">
        Confirmed against a verified corpus row — the rule text below is being
        applied as-is.
      </p>
    );
  }
  if (tier === 2) {
    return (
      <p className="text-xs text-amber-700">
        Not confident enough to apply the law. One clarifying answer re-runs the
        matrix without a new photograph.
      </p>
    );
  }
  return (
    <p className="text-xs text-rose-700">
      Coverage gap: no verified corpus row matches this in this jurisdiction.
      No fine is asserted; general guidance only.
    </p>
  );
}