import { Verdict } from "@/lib/matrix";
import { TierBadge, TierExplanation } from "./TierBadge";

export function VerdictCard({
  verdict,
  jurisdiction,
}: {
  verdict: Verdict | undefined;
  jurisdiction: string;
}) {
  if (!verdict) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-500">
          No verdict yet for {jurisdiction}.
        </p>
      </div>
    );
  }

  const fine =
    verdict.fine_bracket === null
      ? "No numeric fine asserted (not copy-pasted from source)"
      : `${verdict.fine_bracket.currency} ${verdict.fine_bracket.min}–${verdict.fine_bracket.max}`;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <TierBadge tier={verdict.tier} />
        <span className="text-xs font-medium text-slate-500">{jurisdiction}</span>
      </div>
      <div className="mt-3">
        <p className="text-lg font-semibold text-slate-900">
          {verdict.stream ?? "Unknown stream"}
        </p>
        {verdict.clause_id && (
          <p className="mt-0.5 font-mono text-xs text-slate-500">{verdict.clause_id}</p>
        )}
      </div>

      <TierExplanation tier={verdict.tier} />

      <div className="mt-3 space-y-2 text-sm text-slate-700">
        {verdict.rule_text && <p className="leading-relaxed">{verdict.rule_text}</p>}
        {verdict.question && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">{verdict.question}</p>
        )}
        {verdict.guidance && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-rose-800">{verdict.guidance}</p>
        )}
      </div>

      <dl className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Source</dt>
          <dd className="max-w-[60%] truncate text-slate-700">
            {verdict.source_url ? (
              <a
                href={verdict.source_url}
                target="_blank"
                rel="noreferrer"
                className="text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-900"
              >
                {verdict.source_url}
              </a>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Effective</dt>
          <dd className="text-slate-700">{verdict.effective_date ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Fine</dt>
          <dd className="text-slate-700">{fine}</dd>
        </div>
        {verdict.exemptions && verdict.exemptions.length > 0 && (
          <div className="flex flex-col gap-1 pt-1">
            <dt className="text-slate-500">Exemptions</dt>
            {verdict.exemptions.map((ex, i) => (
              <dd key={i} className="text-slate-600">
                {ex.condition ?? ex.note ?? ""}
                {ex.applies_until ? ` (until ${ex.applies_until})` : ""}
              </dd>
            ))}
          </div>
        )}
      </dl>
    </div>
  );
}