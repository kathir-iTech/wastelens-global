import { Verdict } from "@/lib/matrix";
import { TierBadge, TierExplanation, Tier } from "./TierBadge";
import { cn } from "@/lib/cn";

const TIER_BAR: Record<Tier, string> = {
  1: "border-l-tier1",
  2: "border-l-tier2",
  3: "border-l-tier3",
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
    <article className={cn("border border-hairline border-l-4 bg-card p-5", TIER_BAR[tier])}>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <TierBadge tier={tier} />
        <span className="font-mono text-xs text-muted">{jurisdiction}</span>
      </header>

      <h3 className="mt-3 text-lg font-semibold text-ink">
        {verdict.stream ?? "Unknown stream"}
      </h3>
      {verdict.clause_id && (
        <p className="mt-1 break-words font-mono text-sm text-muted">{verdict.clause_id}</p>
      )}

      <TierExplanation tier={tier} />

      <div className="mt-3 space-y-2 text-sm leading-relaxed text-ink">
        {verdict.rule_text && <p>{verdict.rule_text}</p>}
        {verdict.question && (
          <p className="border-l-2 border-tier2 pl-3 text-tier2">{verdict.question}</p>
        )}
        {verdict.guidance && (
          <p className="border-l-2 border-tier3 pl-3 text-tier3">{verdict.guidance}</p>
        )}
      </div>

      <dl className="mt-4 space-y-3 border-t border-hairline pt-3">
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
          <dd className="mt-0.5 font-mono text-sm text-ink">{verdict.effective_date ?? "—"}</dd>
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
    </article>
  );
}