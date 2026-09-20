import { Fragment } from "react";
import gallery from "@/data/sample_gallery.json";
import { TierBadge, Tier } from "./TierBadge";
import { cn } from "@/lib/cn";

const TIER_BAR: Record<Tier, string> = {
  1: "border-l-tier1 bg-tier1/[0.07]",
  2: "border-l-tier2 bg-tier2/[0.07]",
  3: "border-l-tier3 bg-tier3/[0.07]",
};

interface GalleryVerdict {
  tier: number;
  stream: string | null;
  clause_id: string | null;
  rule_text: string | null;
  source_url: string | null;
  effective_date: string | null;
  question?: string;
  guidance?: string;
}

interface GalleryCase {
  case_id: string;
  item_id: string;
  label: string;
  jurisdiction: string;
  note: string;
  image: string;
  verdict: GalleryVerdict;
}

const CASE_LABEL: Record<string, string> = {
  india: "India",
  nyc: "New York",
  england: "England",
};

export function SampleGallery({ onSelect }: { onSelect?: (itemId: string, imagePath: string) => void }) {
  const cases = (gallery as { cases: GalleryCase[] }).cases;

  const groups: Array<{ item_id: string; rows: GalleryCase[] }> = [];
  for (const c of cases) {
    const last = groups[groups.length - 1];
    if (last && last.item_id === c.item_id) {
      last.rows.push(c);
    } else {
      groups.push({ item_id: c.item_id, rows: [c] });
    }
  }

  return (
    <section className="mt-12">
      <h2 className="text-xl font-semibold text-ink">
        Docket — {cases.length} pre-adjudicated cases
      </h2>
      <p className="mt-1 text-sm text-muted">
        Each ruling was computed by the matrix from the bundled corpus, not hand-typed.
        Self-contained, zero network calls.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <Fragment key={g.item_id}>
            {g.rows.length > 1 && (
              <div className="col-span-full">
                <p className="inline-flex items-center gap-2 rounded-full border border-tier2/40 border-l-2 bg-tier2/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-tier2">
                  Same item, {g.rows.length} rulings — {g.rows[0].label}
                </p>
              </div>
            )}
            {g.rows.map((c) => {
          const tier = c.verdict.tier as Tier;
          return (
            <article
              key={c.case_id}
              className={cn(
                "flex flex-col overflow-hidden rounded-2xl border border-white/10 border-l-4 shadow-[0_8px_32px_rgba(0,0,0,0.25)] backdrop-blur-xl",
                TIER_BAR[tier],
                onSelect ? "cursor-pointer hover:opacity-90" : ""
              )}
              onClick={() => onSelect?.(c.item_id, c.image)}
            >
              <div className="border-b border-white/10 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/${c.image.replaceAll("\\", "/")}`}
                  alt={`${c.label} (${c.item_id})`}
                  width={640}
                  height={480}
                  className="aspect-video w-full rounded-lg border border-white/10 object-cover"
                />
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <TierBadge tier={tier} />
                  <span className="font-mono text-xs text-muted">
                    {CASE_LABEL[c.jurisdiction] ?? c.jurisdiction}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-ink">{c.label}</h3>
                <p className="text-sm text-muted">{c.note}</p>
                {c.verdict.stream && (
                  <p className="text-sm font-medium text-ink">Stream: {c.verdict.stream}</p>
                )}
                {c.verdict.clause_id && (
                  <p className="break-words font-mono text-xs text-muted">{c.verdict.clause_id}</p>
                )}
                {c.verdict.question && <p className="text-sm text-tier2">{c.verdict.question}</p>}
                {c.verdict.guidance && <p className="text-sm text-tier3">{c.verdict.guidance}</p>}
                {c.verdict.source_url && (
                  <a
                    href={c.verdict.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-auto block break-all font-mono text-sm text-ink underline decoration-hairline underline-offset-2 hover:decoration-accent"
                  >
                    {c.verdict.source_url}
                  </a>
                )}
              </div>
            </article>
          );
            })}
          </Fragment>
        ))}
      </div>
    </section>
  );
}