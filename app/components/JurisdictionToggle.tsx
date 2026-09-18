import { JURISDICTIONS, Jurisdiction } from "@/lib/corpus";
import { JURISDICTION_LABELS } from "@/lib/verdictState";
import { cn } from "@/lib/cn";

export function JurisdictionToggle({
  value,
  onChange,
}: {
  value: Jurisdiction;
  onChange: (j: Jurisdiction) => void;
}) {
  return (
    <div className="flex max-w-full flex-wrap rounded-lg border border-slate-200 bg-slate-50 p-1">
      {JURISDICTIONS.map((j) => (
        <button
          key={j}
          type="button"
          onClick={() => onChange(j)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === j
              ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
              : "text-slate-500 hover:text-slate-800"
          )}
        >
          {JURISDICTION_LABELS[j]}
        </button>
      ))}
    </div>
  );
}