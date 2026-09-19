import { JURISDICTIONS, Jurisdiction } from "@/lib/corpus";
import { cn } from "@/lib/cn";

const SHORT: Record<Jurisdiction, string> = {
  india: "India",
  nyc: "New York",
  england: "England",
};

export function JurisdictionToggle({
  value,
  onChange,
}: {
  value: Jurisdiction;
  onChange: (j: Jurisdiction) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Jurisdictions">
        {JURISDICTIONS.map((j) => (
          <button
            key={j}
            type="button"
            role="tab"
            aria-selected={value === j}
            onClick={() => onChange(j)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              value === j
                ? "border-accent/60 bg-accent/20 text-ink"
                : "border-white/10 bg-white/[0.04] text-muted hover:border-accent hover:text-ink"
            )}
          >
            {SHORT[j]}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5" aria-hidden="true">
        {JURISDICTIONS.map((j) => (
          <span
            key={j}
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-colors",
              value === j ? "bg-accent" : "bg-white/15"
            )}
          />
        ))}
      </div>
    </div>
  );
}