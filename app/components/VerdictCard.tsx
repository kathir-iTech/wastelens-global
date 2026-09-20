import { ChevronDown } from "lucide-react";
import { Verdict } from "@/lib/matrix";
import { TierBadge, TierExplanation, Tier } from "./TierBadge";
import { cn } from "@/lib/cn";

const TIER_STYLE: Record<Tier, string> = {
  1: "border-l-tier1 bg-tier1/[0.07]",
  2: "border-l-tier2 bg-tier2/[0.07]",
  3: "border-l-tier3 bg-tier3/[0.07]",
};

export function VerdictCard({
  verdict,
  jurisdiction,
}: {
  verdict: Verdict | undefined;
  jurisdiction: string;
}) {
  if (!verdict) {
    return (
      <div className="border border-hairline border-l-4 border-l-hairline bg-card p-5">
        <p className="text-sm text-muted">No ruling yet for {jurisdiction}.</p>
      </div>
    );
  }

  const tier = (verdict.tier ?? 1) as Tier;
  const fine =
    verdict.fine_bracket === null
      ? "No numeric fine asserted. Not copy-pasted from source."
      : `${verdict.fine_bracket.currency} ${verdict.fine_bracket.min}–${verdict.fine_bracket.max}`;

  return (
    <article
      className={cn(
        "rounded-2xl border border-white/10 border-l-4 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-xl",
        TIER_STYLE[tier]
      )}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <TierBadge tier={tier} />
        <span className="font-mono text-xs text-muted">{jurisdiction}</span>
      </header>

      <h3 className="mt-3 text-2xl font-bold tracking-tight text-ink">
        {verdict.stream ?? "Unknown stream"}
      </h3>

      <TierExplanation tier={tier} />

      <details className="group mt-4 rounded-xl border border-white/10 bg-paper/30">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs font-semibold text-ink transition-opacity hover:opacity-80 [&::-webkit-details-marker]:hidden">
          View legal basis
          <ChevronDown
            className="h-4 w-4 text-muted transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="space-y-3 border-t border-white/10 px-3 pb-3 pt-2.5 text-sm leading-relaxed text-ink">
          {verdict.clause_id && (
            <p className="break-words font-mono text-sm text-muted">{verdict.clause_id}</p>
          )}

          {verdict.rule_text && <p>{verdict.rule_text}</p>}
          {verdict.question && (
            <p className="border-l-2 border-tier2 pl-3 text-tier2">{verdict.question}</p>
          )}
          {verdict.guidance && (
            <p className="border-l-2 border-tier3 pl-3 text-tier3">{verdict.guidance}</p>
          )}

          <dl className="space-y-2.5 border-t border-hairline pt-2.5">
            {verdict.source_url && (
              <div>
                <dt className="text-xs text-muted">Source</dt>
                <dd className="mt-0.5">
                  <a
                    href={verdict.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all font-mono text-sm text-ink underline decoration-hairline underline-offset-2 hover:decoration-accent"
                  >
                    {verdict.source_url}
                  </a>
                </dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-muted">Effective date</dt>
              <dd className="mt-0.5 font-mono text-sm text-ink">
                {verdict.effective_date ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Fine</dt>
              <dd className="mt-0.5 text-ink">{fine}</dd>
            </div>
            {verdict.exemptions && verdict.exemptions.length > 0 && (
              <div>
                <dt className="text-xs text-muted">Exemptions</dt>
                {verdict.exemptions.map((ex, i) => (
                  <dd key={i} className="mt-0.5 text-ink">
                    {ex.condition ?? ex.note ?? ""}
                    {ex.applies_until ? ` (until ${ex.applies_until})` : ""}
                  </dd>
                ))}
              </div>
            )}
          </dl>
        </div>
      </details>
    </article>
  );
}