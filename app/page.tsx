"use client";

import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { JURISDICTIONS, Jurisdiction, streamsFor } from "@/lib/corpus";
import {
  createVerdictController,
  VerdictController,
  JURISDICTION_LABELS,
} from "@/lib/verdictState";
import { localVerdict } from "@/lib/localVerdict";
import { Verdict } from "@/lib/matrix";
import { JurisdictionToggle } from "@/app/components/JurisdictionToggle";
import { VerdictCard } from "@/app/components/VerdictCard";
import { Tier2Flow } from "@/app/components/Tier2Flow";
import { SampleGallery } from "@/app/components/SampleGallery";
import { PerceptionCard } from "@/app/components/PerceptionCard";

const SAMPLES: Array<{ id: string; label: string; publicPath: string }> = [
  { id: "B05", label: "Banana peels", publicPath: "/benchmark_images/B05.svg" },
  { id: "B01", label: "Empty glass jar", publicPath: "/benchmark_images/B01.svg" },
  { id: "B12", label: "Paint can", publicPath: "/benchmark_images/B12.svg" },
  { id: "B04", label: "Cardboard box", publicPath: "/benchmark_images/B04.svg" },
  { id: "B13", label: "Grass clippings", publicPath: "/benchmark_images/B13.svg" },
  { id: "B17", label: "Construction debris", publicPath: "/benchmark_images/B17.svg" },
  { id: "B14", label: "Used diaper", publicPath: "/benchmark_images/B14.svg" },
];

async function toDataUri(href: string): Promise<string> {
  const res = await fetch(href);
  if (!res.ok) throw new Error(`fetch ${href} -> ${res.status}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read image blob failed"));
    reader.readAsDataURL(blob);
  });
}

interface PerceptionOutcomeLike {
  output: {
    object_class: string;
    material_surface: string;
    contamination: boolean;
    hazard_flags: string[];
    confidence: number;
  } | null;
  model_id: string | null;
  error?: string;
}

export default function Home() {
  const [activeJuris, setActiveJuris] = useState<Jurisdiction>("india");
  const [mode, setMode] = useState<"A" | "B">("A");
  const [scope, setScope] = useState("households");

  const ctlRef = useRef<VerdictController | null>(null);
  const [version, setVersion] = useState(0);
  if (ctlRef.current === null) {
    ctlRef.current = createVerdictController(async (ref) => {
      const res = await fetch("/api/perceive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_data: ref }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        return { output: null, model_id: null, error: body.error ?? `HTTP ${res.status}` };
      }
      const json = (await res.json()) as PerceptionOutcomeLike;
      return { output: json.output, model_id: json.model_id, error: json.error };
    });
  }
  const ctl = ctlRef.current;
  const ctlState = ctl.getState();

  const [sampleId, setSampleId] = useState<string>(SAMPLES[0].id);
  const [uploadDataUrl, setUploadDataUrl] = useState<string | null>(null);
  const [perceiving, setPerceiving] = useState(false);
  const [perceptionNote, setPerceptionNote] = useState<string | null>(null);
  const [scanStage, setScanStage] = useState<"idle" | "identifying" | "checking">("idle");
  const [scanElapsed, setScanElapsed] = useState(0);
  useEffect(() => {
    if (scanStage === "idle") return;
    const t = setInterval(() => setScanElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [scanStage]);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [perceptionCount, setPerceptionCount] = useState(0);

  const sample = SAMPLES.find((s) => s.id === sampleId) ?? SAMPLES[0];
  const shownImage = uploadDataUrl ?? sample.publicPath;

  function handleGallerySelect(itemId: string, _imagePath: string) {
    setSampleId(itemId);
    setUploadDataUrl(null);
    setGalleryOpen(false);
  }

  const fetchCount = useRef(0);
  const [fetchCountShown, setFetchCountShown] = useState(0);
  useEffect(() => {
    const original = globalThis.fetch;
    globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
      fetchCount.current += 1;
      setFetchCountShown(fetchCount.current);
      return original(...args);
    }) as typeof fetch;
    return () => {
      globalThis.fetch = original;
    };
  }, []);

  async function runPerception() {
    setPerceptionCount((c) => c + 1);
    setPerceiving(true);
    setPerceptionNote(null);
    setScanStage("identifying");
    setScanElapsed(0);
    const stageTimer = setTimeout(() => setScanStage("checking"), 800);
    try {
      const ref = uploadDataUrl ?? (await toDataUri(sample.publicPath));
      await ctl.perceiveImage(ref);
      for (const juris of JURISDICTIONS) {
        await ctl.selectJurisdiction(juris, scope);
      }
      setVersion((v) => v + 1);
      const st = ctl.getState();
      if (st.perception?.output === null) {
        setPerceptionNote(
          st.perception?.error ?? "Perception returned no output."
        );
      }
    } finally {
      clearTimeout(stageTimer);
      setScanStage("idle");
      setPerceiving(false);
    }
  }

  const docketRefs = useRef<Record<Jurisdiction, HTMLDivElement | null>>({
    india: null,
    nyc: null,
    england: null,
  });

  async function onToggle(next: Jurisdiction) {
    setActiveJuris(next);
    setVersion((v) => v + 1);
    if (mode === "A") {
      docketRefs.current[next]?.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
      await ctl.selectJurisdiction(next, scope);
    }
  }

  function onDocketScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const mid = el.scrollLeft + el.clientWidth / 2;
    const juris = mode === "A" ? JURISDICTIONS : [activeJuris];
    let best = juris[0];
    let bestDist = Infinity;
    for (let i = 0; i < el.children.length; i++) {
      const c = el.children[i] as HTMLElement;
      const cmid = c.offsetLeft + c.offsetWidth / 2;
      const d = Math.abs(cmid - mid);
      if (d < bestDist) {
        bestDist = d;
        best = juris[i];
      }
    }
    if (best !== activeJuris) setActiveJuris(best);
  }

  async function onClarify(answer: Record<string, unknown>, sc: string) {
    await ctl.answerClarify(activeJuris, sc, answer);
    setVersion((v) => v + 1);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setUploadDataUrl(String(reader.result));
    reader.readAsDataURL(file);
  }

  // Mode B state
  const [bStream, setBStream] = useState("wet");
  const [bScope, setBScope] = useState("households");
  const [bConfidence, setBConfidence] = useState(0.99);
  const [bVerdict, setBVerdict] = useState<Verdict | null>(null);
  const [bUsedNetwork, setBUsedNetwork] = useState(false);
  const [bStreamOptions, setBStreamOptions] = useState<string[]>(streamsFor("india"));

  useEffect(() => {
    setBStreamOptions(streamsFor(activeJuris));
    if (!streamsFor(activeJuris).includes(bStream)) {
      setBStream(streamsFor(activeJuris)[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeJuris]);

  async function runModeB() {
    const { verdict: v, used_network } = await localVerdict({
      jurisdiction: activeJuris,
      attributes: { stream: bStream, scope: bScope },
      confidence: bConfidence,
      generator_class: "wastelens-mode-b",
      rule_version: "1.0",
    });
    setBVerdict(v);
    setBUsedNetwork(used_network);
  }

  const docketJuris: Jurisdiction[] = mode === "A" ? JURISDICTIONS : [activeJuris];

  const verdictFor = (j: Jurisdiction) =>
    mode === "A" ? ctlState.verdicts[j] : j === activeJuris ? bVerdict ?? undefined : undefined;

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -left-24 -top-40 h-[420px] w-[420px] animate-drift rounded-full bg-tier1/15 blur-3xl" />
        <div className="absolute right-[-12%] top-16 h-[380px] w-[380px] animate-drift rounded-full bg-tier2/10 blur-3xl [animation-delay:-6s]" />
        <div className="absolute left-[38%] top-[480px] h-[300px] w-[300px] animate-drift rounded-full bg-tier3/10 blur-3xl [animation-delay:-12s]" />
        <div className="absolute inset-x-0 top-0 h-[480px] bg-gradient-to-b from-transparent via-paper/60 to-paper" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-8">
        <header className="mb-10 pt-2 md:pt-8">
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-tier2">
            Perception proposes.
          </p>
          <h1 className="mt-3 text-5xl font-bold tracking-tight text-ink md:text-6xl">
            WasteLens <span className="text-tier1">Global</span>
          </h1>
          <p className="mt-3 text-xl text-muted md:text-2xl">The law decides.</p>
          <p className="mt-4 text-lg text-muted">Photograph waste, get the statute.</p>
        </header>

        <div className="mb-4 inline-flex flex-wrap gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1 shadow-[0_4px_18px_rgba(0,0,0,0.25)] backdrop-blur-xl">
          {(["A", "B"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={
                mode === m
                  ? "rounded-xl bg-ink px-4 py-1.5 text-sm font-semibold text-paper"
                  : "rounded-xl px-4 py-1.5 text-sm font-medium text-muted hover:text-ink"
              }
            >
              Mode {m}: {m === "A" ? "Snapshot perception" : "Known attributes (offline)"}
            </button>
          ))}
        </div>

        {mode === "A" && (
          <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-xl">
            <h2 className="text-base font-semibold text-ink">Mode A — perception</h2>

            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-tier1 px-6 py-3 text-sm font-bold text-paper shadow-[0_4px_16px_rgba(127,209,160,0.25)] transition-opacity hover:opacity-90">
                  <Camera className="h-5 w-5" aria-hidden="true" />
                  Take a photo
                  <input type="file" accept="image/*" capture="environment" onChange={onFile} className="sr-only" />
                </label>
                {uploadDataUrl === null && (
                  <span className="text-xs text-muted">
                    or pick one of the {SAMPLES.length} bundled samples below.
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {SAMPLES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSampleId(s.id);
                      setUploadDataUrl(null);
                    }}
                    className={
                      sampleId === s.id && !uploadDataUrl
                        ? "rounded-lg bg-ink px-3 py-1 text-xs font-semibold text-paper"
                        : "rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-muted hover:border-accent hover:text-ink"
                    }
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-white/10 bg-paper/40 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={shownImage}
                  alt="image to perceive"
                  width={640}
                  height={480}
                  className="aspect-video w-full rounded-lg border border-white/10 object-cover"
                />
              </div>

              <button
                type="button"
                onClick={runPerception}
                disabled={perceiving}
                className="rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-paper hover:opacity-90 disabled:opacity-50"
              >
                {perceiving ? "Scanning…" : "Run perception"}
              </button>

              {scanStage !== "idle" && (
                <p className="animate-pulse text-xs font-medium text-ink" role="status">
                  {scanStage === "identifying"
                    ? "Identifying item…"
                    : scanElapsed < 2
                      ? `Consulting the law — ${JURISDICTION_LABELS[activeJuris]}…`
                      : `Gemini's busy, still trying… (${scanElapsed}s)`}
                </p>
              )}

              <div className="text-xs text-muted">
                Perception invocations this session:{" "}
                <span className="font-mono font-semibold">{perceptionCount}</span>
                {perceptionCount > 0 && (
                  <span> — cached across jurisdiction switch</span>
                )}
              </div>

              {ctlState.perception?.output && (
                <PerceptionCard
                  result={ctlState.perception.output}
                  modelId={ctlState.perception.model_id}
                />
              )}
              {perceptionNote && (
                <p className="rounded-xl border border-tier3/40 border-l-2 bg-tier3/10 px-3 py-2 text-sm text-tier3">
                  {perceptionNote}
                </p>
              )}

              <div className="mt-4 border-t border-hairline pt-3">
                {!galleryOpen ? (
                  <button
                    type="button"
                    onClick={() => setGalleryOpen(true)}
                    className="text-sm text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
                  >
                    No camera? See an example instead
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setGalleryOpen(false)}
                      className="text-xs text-muted hover:text-ink"
                    >
                      Hide examples
                    </button>
                    <SampleGallery onSelect={handleGallerySelect} />
                  </>
                )}
              </div>

              <details className="mt-1 text-sm text-muted">
                <summary className="cursor-pointer text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent">
                  Why trust this? — method & sources
                </summary>
                <p className="mt-2 leading-relaxed">
                  Verdicts are deterministic matrix lookups against verified corpus rows
                  (India SWM 2026, NYC Local Law 19 / §16-324, England SI 2025/140) — not
                  generated text. Perception runs once per image and is cached across
                  jurisdiction switches. Every number shown here is real.
                </p>
              </details>
            </div>
          </section>
        )}

        {mode === "B" && (
          <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-xl">
            <h2 className="text-base font-semibold text-ink">Mode B — local rules → matrix</h2>
            <button
              type="button"
              onClick={() => setAdvancedOpen(!advancedOpen)}
              className="mt-2 text-sm text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
            >
              {advancedOpen ? "Collapse advanced / offline mode" : "advanced / offline mode"}
            </button>
            {advancedOpen && (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-muted">
                  No photograph required. Known attributes are resolved against the bundled
                  rules corpus entirely on-device — script enforces zero network calls (tests
                  override globalThis.fetch to throw).
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-xs font-medium text-ink">
                    Stream
                    <select
                      value={bStream}
                      onChange={(e) => setBStream(e.target.value)}
                      className="rounded-lg border border-white/10 bg-card px-2 py-1.5 text-sm text-ink"
                    >
                      {bStreamOptions.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-ink">
                    Source
                    <select
                      value={bScope}
                      onChange={(e) => setBScope(e.target.value)}
                      className="rounded-lg border border-white/10 bg-card px-2 py-1.5 text-sm text-ink"
                    >
                      <option value="households">Households</option>
                      <option value="commercial">Commercial</option>
                    </select>
                  </label>
                </div>
                <label className="flex flex-col gap-1 text-xs font-medium text-ink">
                  Perception confidence: {(bConfidence * 100).toFixed(0)}%
                  <input
                    type="range"
                    min={0.5}
                    max={1}
                    step={0.01}
                    value={bConfidence}
                    onChange={(e) => setBConfidence(Number(e.target.value))}
                    className="accent-ink"
                  />
                </label>
                <button
                  type="button"
                  onClick={runModeB}
                  className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-paper hover:opacity-90"
                >
                  Get verdict (Mode B)
                </button>
                <p className="text-xs text-muted">
                  network calls: <span className="font-mono font-semibold text-ink">{fetchCountShown}</span>{" "}
                  {bVerdict && (
                    <span className="text-tier1">
                      Mode B used_network={String(bUsedNetwork)}
                    </span>
                  )}
                </p>
              </div>
            )}
          </section>
        )}

        {ctlState.perception?.output && (
          <section className="animate-rise mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-ink">Docket</h2>
              <JurisdictionToggle value={activeJuris} onChange={onToggle} />
            </div>
            <p className="mt-2 text-xs text-muted">
              One perception, three rulings. The matrix re-runs per jurisdiction; perception
              does not.
            </p>

            <div className="docket-scroll -mx-5 mt-4 flex snap-x gap-3 overflow-x-auto px-5 pb-1" onScroll={onDocketScroll}>
              {docketJuris.map((j) => (
                <div
                  key={j}
                  ref={(el) => {
                    docketRefs.current[j] = el;
                  }}
                  className="docket-ruling w-[86%] shrink-0 sm:w-full"
                >
                  {(() => {
                    const v = verdictFor(j);
                    return (
                      <>
                        <VerdictCard verdict={v} jurisdiction={JURISDICTION_LABELS[j]} />
                        {mode === "A" && v && v.tier === 2 && (
                          <div className="mt-3">
                            <Tier2Flow verdict={v} jurisdiction={j} onAnswer={onClarify} />
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}