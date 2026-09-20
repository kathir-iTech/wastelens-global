import { Ban, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export interface PerceptionResult {
  object_class: string;
  material_surface: string;
  contamination: boolean;
  hazard_flags: string[];
  confidence: number;
}

export function PerceptionCard({
  result,
  modelId,
}: {
  result: PerceptionResult;
  modelId: string | null;
}) {
  const confidence = Math.round((result.confidence ?? 0) * 100);
  const R = 22;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - confidence / 100);
  const ringTone =
    confidence >= 80 ? "text-tier1" : confidence >= 60 ? "text-tier2" : "text-tier3";

  return (
    <div className="animate-rise rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-xl">
      <p className="text-xs uppercase tracking-[0.2em] text-muted">Perception</p>
      <h3 className="mt-1.5 text-2xl font-bold tracking-tight text-ink">
        {result.object_class}
        <span className="mx-2 font-medium text-tier1">—</span>
        <span className="font-medium text-muted">{result.material_surface}</span>
      </h3>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
            result.contamination
              ? "border-tier3/40 bg-tier3/15 text-tier3"
              : "border-tier1/40 bg-tier1/15 text-tier1"
          )}
        >
          {result.contamination ? (
            <Ban className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {result.contamination ? "Contaminated" : "Clear"}
        </span>
        {result.hazard_flags.map((h) => (
          <span
            key={h}
            className="rounded-full border border-tier3/40 bg-tier3/15 px-2.5 py-1 text-xs font-medium text-tier3"
          >
            {h}
          </span>
        ))}
      </div>

      <details className="group mt-4 rounded-xl border border-white/10 bg-paper/30">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs font-semibold text-ink transition-opacity hover:opacity-80 [&::-webkit-details-marker]:hidden">
          View legal basis
          <ChevronDown
            className="h-4 w-4 text-muted transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="flex flex-wrap items-center gap-3 border-t border-white/10 px-3 pb-3 pt-2.5">
          <div
            className="relative h-16 w-16 shrink-0"
            role="img"
            aria-label={`confidence ${confidence} percent`}
          >
            <svg viewBox="0 0 56 56" className={cn("h-16 w-16 -rotate-90", ringTone)}>
              <circle
                cx="28"
                cy="28"
                r="22"
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="6"
              />
              <circle
                cx="28"
                cy="28"
                r="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${C}`}
                strokeDashoffset={offset}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-ink">
              {confidence}%
            </span>
          </div>
          <p className="font-mono text-xs text-muted">engine: {modelId ?? "no model"}</p>
        </div>
      </details>
    </div>
  );
}