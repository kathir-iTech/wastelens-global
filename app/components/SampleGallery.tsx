import gallery from "@/data/sample_gallery.json";
import { TierBadge } from "./TierBadge";

interface GalleryVerdict {
  tier: 1 | 2 | 3;
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

export function SampleGallery() {
  const cases = (gallery as { cases: GalleryCase[] }).cases;

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-slate-900">
        Sample gallery — 9 judge-proof cached cases
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Snapshots computed by lib/matrix.ts (see data/sample_gallery.json). Self-contained,
        zero network calls.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cases.map((c) => (
          <article
            key={c.case_id}
            className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="bg-slate-50 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/${c.image.replaceAll("\\", "/")}`}
                alt={`${c.label} (${c.item_id})`}
                width={640}
                height={480}
                className="aspect-video w-full rounded-lg border border-slate-200 object-cover"
              />
            </div>
            <div className="flex flex-1 flex-col gap-2 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-slate-400">{c.case_id}</span>
                <span className="text-xs font-medium text-slate-600">{c.jurisdiction}</span>
              </div>
              <h3 className="text-sm font-semibold text-slate-900">{c.label}</h3>
              <TierBadge tier={c.verdict.tier} />
              <p className="text-xs text-slate-500">{c.note}</p>
              {c.verdict.stream && (
                <p className="text-sm font-medium text-slate-700">Stream: {c.verdict.stream}</p>
              )}
              {c.verdict.clause_id && (
                <p className="font-mono text-[11px] text-slate-500">{c.verdict.clause_id}</p>
              )}
              {c.verdict.question && (
                <p className="text-xs text-amber-700">{c.verdict.question}</p>
              )}
              {c.verdict.guidance && (
                <p className="text-xs text-rose-700">{c.verdict.guidance}</p>
              )}
              {c.verdict.source_url && (
                <a
                  href={c.verdict.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-auto inline-block truncate text-[11px] text-sky-700 underline decoration-sky-300 underline-offset-2"
                >
                  {c.verdict.source_url}
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}