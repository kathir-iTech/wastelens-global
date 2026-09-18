"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const SAMPLES: Array<{ id: string; label: string; dataPath: string; publicPath: string }> = [
  { id: "B05", label: "Banana peels", dataPath: "data/benchmark_images/B05.svg", publicPath: "/benchmark_images/B05.svg" },
  { id: "B01", label: "Empty glass jar", dataPath: "data/benchmark_images/B01.svg", publicPath: "/benchmark_images/B01.svg" },
  { id: "B12", label: "Paint can", dataPath: "data/benchmark_images/B12.svg", publicPath: "/benchmark_images/B12.svg" },
  { id: "B04", label: "Cardboard box", dataPath: "data/benchmark_images/B04.svg", publicPath: "/benchmark_images/B04.svg" },
  { id: "B13", label: "Grass clippings", dataPath: "data/benchmark_images/B13.svg", publicPath: "/benchmark_images/B13.svg" },
  { id: "B17", label: "Construction debris", dataPath: "data/benchmark_images/B17.svg", publicPath: "/benchmark_images/B17.svg" },
  { id: "B14", label: "Used diaper", dataPath: "data/benchmark_images/B14.svg", publicPath: "/benchmark_images/B14.svg" },
];

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
        body: JSON.stringify(
          ref.startsWith("data:") ? { image_data: ref } : { image_path: ref }
        ),
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
  const verdict = activeJuris !== null ? ctlState.verdicts[activeJuris] : undefined;

  const [sampleId, setSampleId] = useState<string>(SAMPLES[0].id);
  const [uploadDataUrl, setUploadDataUrl] = useState<string | null>(null);
  const [perceiving, setPerceiving] = useState(false);
  const [perceptionNote, setPerceptionNote] = useState<string | null>(null);
  const [scanStage, setScanStage] = useState<"idle" | "identifying" | "checking">("idle");

  const sample = SAMPLES.find((s) => s.id === sampleId) ?? SAMPLES[0];
  const shownImage = uploadDataUrl ?? sample.publicPath;

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
    setPerceiving(true);
    setPerceptionNote(null);
    setScanStage("identifying");
    const stageTimer = setTimeout(() => setScanStage("checking"), 800);
    try {
      const ref = uploadDataUrl ?? sample.dataPath;
      await ctl.perceiveImage(ref);
      await ctl.selectJurisdiction(activeJuris, scope);
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

  async function onToggle(next: Jurisdiction) {
    setActiveJuris(next);
    await ctl.selectJurisdiction(next, scope);
    setVersion((v) => v + 1);
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

  return (
    <main className="min-h-screen bg-slate-100 py-10">
      <div className="mx-auto max-w-6xl px-4">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">WasteLens Global</h1>
          <p className="mt-1 text-slate-600">
            Perception proposes. The law decides.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Verdicts are deterministic matrix lookups against verified corpus rows
            (India SWM 2026 · NYC LL85/§16-324 · England SI 2025/140). Perception
            runs once per image and is cached across jurisdiction switch.
          </p>
        </header>

        <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {(["A", "B"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={
                mode === m
                  ? "rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white"
                  : "rounded-md px-4 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
              }
            >
              Mode {m}: {m === "A" ? "Snapshot perception" : "Known attributes (offline)"}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              {mode === "A" ? "Mode A — perception" : "Mode B — local rules.json → matrix"}
            </h2>

            {mode === "A" ? (
              <div className="mt-4 space-y-4">
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
                          ? "rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white"
                          : "rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-400"
                      }
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                <input type="file" accept="image/*" onChange={onFile} className="block w-full text-xs" />

                <div className="border border-slate-100 rounded-lg bg-slate-50 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={shownImage}
                    alt="image to perceive"
                    width={640}
                    height={480}
                    className="aspect-video w-full rounded-md object-cover"
                  />
                </div>

                <button
                  type="button"
                  onClick={runPerception}
                  disabled={perceiving}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {perceiving ? "Scanning…" : "Run perception"}
                </button>

                {scanStage !== "idle" && (
                  <p className="animate-pulse text-xs font-medium text-slate-600" role="status">
                    {scanStage === "identifying"
                      ? "Identifying item…"
                      : `Checking ${JURISDICTION_LABELS[activeJuris]} law…`}
                  </p>
                )}

                <div className="text-xs text-slate-500">
                  Perception invocations this session:{" "}
                  <span className="font-mono font-semibold">{ctlState.perceiveInvocations}</span>
                  {ctlState.perceiveInvocations > 0 && (
                    <span className="text-slate-400"> — cached across jurisdiction switch</span>
                  )}
                </div>

                {ctlState.perception?.output && (
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">
                      {ctlState.perception.output.object_class} · {ctlState.perception.output.material_surface}
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">
                      contaminated: {ctlState.perception.output.contamination ? "yes" : "no"}
                    </span>
                    {ctlState.perception.output.hazard_flags.map((h) => (
                      <span key={h} className="rounded-md bg-rose-50 px-2 py-1 text-rose-700">
                        {h}
                      </span>
                    ))}
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">
                      confidence {(ctlState.perception.output.confidence * 100).toFixed(0)}%
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-slate-500">
                      {ctlState.perception.model_id ?? "no model"}
                    </span>
                  </div>
                )}
                {perceptionNote && (
                  <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {perceptionNote}
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-slate-500">
                  No photograph required. Known attributes are resolved against the
                  bundled rules corpus entirely on-device — script enforces zero
                  network calls (tests override globalThis.fetch to throw).
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                    Stream
                    <select
                      value={bStream}
                      onChange={(e) => setBStream(e.target.value)}
                      className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    >
                      {bStreamOptions.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                    Source
                    <select
                      value={bScope}
                      onChange={(e) => setBScope(e.target.value)}
                      className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    >
                      <option value="households">Households</option>
                      <option value="commercial">Commercial</option>
                    </select>
                  </label>
                </div>
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                  Perception confidence: {(bConfidence * 100).toFixed(0)}%
                  <input
                    type="range"
                    min={0.5}
                    max={1}
                    step={0.01}
                    value={bConfidence}
                    onChange={(e) => setBConfidence(Number(e.target.value))}
                  />
                </label>
                <button
                  type="button"
                  onClick={runModeB}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                >
                  Get verdict (Mode B)
                </button>
                <p className="text-xs text-slate-500">
                  network calls: <span className="font-mono font-semibold">{fetchCountShown}</span>{" "}
                  {bVerdict && (
                    <span className="text-emerald-700">
                      · Mode B used_network={String(bUsedNetwork)}
                    </span>
                  )}
                </p>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">The law</h2>
              <JurisdictionToggle value={activeJuris} onChange={onToggle} />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Same perception output, jurisdiction switched client-side — the
              matrix re-runs but perception does not.
            </p>
            <div className="mt-4">
              <VerdictCard verdict={mode === "A" ? verdict : bVerdict ?? undefined} jurisdiction={JURISDICTION_LABELS[activeJuris]} />
            </div>
            {mode === "A" && verdict && verdict.tier === 2 && (
              <div className="mt-3">
                <Tier2Flow verdict={verdict} jurisdiction={activeJuris} onAnswer={onClarify} />
              </div>
            )}
          </section>
        </div>

        <SampleGallery />
      </div>
    </main>
  );
}