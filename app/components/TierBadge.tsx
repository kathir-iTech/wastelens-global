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
  // Geometric shapes so tier reads without color:
  // Confirmed = circle + check, Clarify = diamond + question, Gap = octagon + !.
  if (tier === 1) {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="10" cy="10" r="7" />
        <path d="M6.5 10.2 9 12.7 13.5 7.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (tier === 2) {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="10" y="10" width="11.3" height="11.3" transform="rotate(45 10 10)" />
        <text
          x="10"
          y="14"
          textAnchor="middle"
          stroke="none"
          fill="currentColor"
          fontSize="11"
          fontWeight="700"
          fontFamily="IBM Plex Sans, sans-serif"
        >
          ?
        </text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M7.1 2.5 2.5 7.1v5.8L7.1 17.5h5.8l4.6-4.6V7.1L12.9 2.5z" strokeLinejoin="round" />
      <text
        x="10"
        y="14.5"
        textAnchor="middle"
        stroke="none"
        fill="currentColor"
        fontSize="12"
        fontWeight="700"
        fontFamily="IBM Plex Sans, sans-serif"
      >
        !
      </text>
    </svg>
  );
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