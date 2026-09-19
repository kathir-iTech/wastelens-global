import { useState } from "react";
import { Verdict } from "@/lib/matrix";
import { Jurisdiction } from "@/lib/corpus";
import { TierBadge } from "./TierBadge";

export function Tier2Flow({
  verdict,
  jurisdiction,
  onAnswer,
}: {
  verdict: Verdict;
  jurisdiction: Jurisdiction;
  onAnswer: (answer: Record<string, unknown>, scope: string) => void;
}) {
  const [scope, setScope] = useState("households");
  const [customStream, setCustomStream] = useState("");

  if (verdict.tier !== 2) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const answer: Record<string, unknown> = {};
    if (customStream.trim()) answer["stream"] = customStream.trim();
    onAnswer(answer, scope);
  }

  return (
    <div className="border border-hairline border-t-2 border-t-tier2 bg-card p-4">
      <div className="flex items-center gap-2">
        <TierBadge tier={2} />
        <span className="text-sm font-medium text-ink">Clarifying before judging</span>
      </div>
      <p className="mt-2 text-sm text-tier2">{verdict.question}</p>
      <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-ink">
          Source
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="rounded-sm border border-hairline bg-card px-2 py-1.5 text-sm text-ink"
          >
            <option value="households">Households</option>
            <option value="commercial">Commercial</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-ink">
          Correct stream (optional)
          <input
            value={customStream}
            onChange={(e) => setCustomStream(e.target.value)}
            placeholder="e.g. dry, food, paper-card"
            className="rounded-sm border border-hairline bg-card px-2 py-1.5 text-sm text-ink placeholder:text-muted"
          />
        </label>
        <button
          type="submit"
          className="rounded-sm bg-tier2 px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Re-run matrix with answer
        </button>
      </form>
      <p className="mt-2 text-xs text-muted">
        The answer is applied to the cached perception output for {jurisdiction} — no new
        photograph, no new vision call.
      </p>
    </div>
  );
}