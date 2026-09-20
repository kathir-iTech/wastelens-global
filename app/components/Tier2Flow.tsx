"use client";

import { useState } from "react";
import {
  FileText,
  GlassWater,
  HeartPulse,
  Package,
  Recycle,
  Trash2,
  Utensils,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Verdict } from "@/lib/matrix";
import { Jurisdiction, streamsFor } from "@/lib/corpus";
import { TierBadge } from "./TierBadge";
import { cn } from "@/lib/cn";

const STREAM_ICONS: Record<string, LucideIcon> = {
  food: Utensils,
  dry: Recycle,
  "paper-card": FileText,
  glass: GlassWater,
  residual: Trash2,
  sanitary: HeartPulse,
};

function streamLabel(id: string) {
  return id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function Tier2Flow({
  verdict,
  jurisdiction,
  onAnswer,
  imageSrc,
}: {
  verdict: Verdict;
  jurisdiction: Jurisdiction;
  onAnswer: (answer: Record<string, unknown>, scope: string) => void;
  imageSrc?: string | null;
}) {
  const [scope, setScope] = useState("households");
  const [customStream, setCustomStream] = useState("");
  const [applied, setApplied] = useState<string | null>(null);

  if (verdict.tier !== 2) return null;

  const streams = streamsFor(jurisdiction);

  function answer(sid: string) {
    setApplied(sid);
    onAnswer({ stream: sid }, scope);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const answer: Record<string, unknown> = {};
    if (customStream.trim()) answer["stream"] = customStream.trim();
    setApplied(customStream.trim() || null);
    onAnswer(answer, scope);
  }

  return (
    <div className="border border-hairline border-t-2 border-t-tier2 bg-card p-4">
      <div className="flex items-center gap-2">
        <TierBadge tier={2} />
        <span className="text-sm font-medium text-ink">Clarifying before judging</span>
      </div>
      <p className="mt-2 text-sm text-tier2">{verdict.question}</p>

      {imageSrc && (
        <>
          <div className="relative mt-3 overflow-hidden rounded-lg border border-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc}
            alt="item being clarified"
            className="h-44 w-full object-cover"
            width={640}
            height={360}
          />
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap gap-1.5 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2.5 pb-2.5 pt-8">
            {streams.map((sid) => {
              const Icon = STREAM_ICONS[sid] ?? Package;
              const isApplied = applied === sid;
              return (
                <button
                  key={sid}
                  type="button"
                  onClick={() => answer(sid)}
                  aria-pressed={isApplied}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors",
                    isApplied
                      ? "border-tier2/60 bg-tier2/90 text-white"
                      : "border-white/20 bg-black/55 text-white backdrop-blur-sm hover:border-tier2/50 hover:bg-black/70"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {streamLabel(sid)}
                </button>
              );
            })}
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">
            Tap a stream icon on the photo to answer, or use the form below — both re-run the
            same matrix (no new photograph, no new vision call).
          </p>
        </>
      )}

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