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
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center gap-2">
        <TierBadge tier={2} />
        <span className="text-sm font-medium text-amber-900">
          Clarifying before judging
        </span>
      </div>
      <p className="mt-2 text-sm text-amber-800">{verdict.question}</p>
      <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-amber-900">
          Source
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="rounded-md border border-amber-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="households">Households</option>
            <option value="commercial">Commercial</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-amber-900">
          Correct stream (optional)
          <input
            value={customStream}
            onChange={(e) => setCustomStream(e.target.value)}
            placeholder="e.g. dry, food, paper-card"
            className="rounded-md border border-amber-300 bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
        >
          Re-run matrix with answer
        </button>
      </form>
      <p className="mt-2 text-xs text-amber-700">
        Answer is applied to the cached perception output for {jurisdiction} —
        no new photograph, no new vision call.
      </p>
    </div>
  );
}