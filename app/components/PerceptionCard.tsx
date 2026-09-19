import { Ban, Check } from "lucide-react";
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Perception</p>
          <h3 className="mt-1.5 text-2xl font-bold tracking-tight text-ink">
            {result.object_class}
            <span className="mx-2 font-medium text-tier1">—</span>
            <span className="font-medium text-muted">{result.material_surface}</span>
          </h3>
        </div>
        <div className="relative h-16 w-16 shrink-0" aria-hidden="true">
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
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
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

      <p className="mt-4 border-t border-white/10 pt-3 font-mono text-xs text-muted">
        engine: {modelId ?? "no model"}
      </p>
    </div>
  );
}