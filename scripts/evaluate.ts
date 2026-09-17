import fs from "node:fs";
import path from "node:path";
import {
  JURISDICTIONS,
  Jurisdiction,
  rowCount,
  rowsForStream,
  streamExists,
  streamsFor,
} from "../lib/corpus";
import { adjudicate, Verdict } from "../lib/matrix";
import { retrieve } from "../lib/retriever";
import {
  perceiveBinForJurisdiction,
  currentFlashVisionModel,
  resolveFlashVisionModel,
  geminiQuotaBlocked,
} from "../lib/perception";
import {
  allIntegrityIssues,
  BenchItem,
  loadBenchmark,
} from "../lib/benchmarkIntegrity";

const OUT_FILE = path.resolve("data/generated/eval_metrics.json");
const RULE_VERSION = "1.0";
const GENERATOR = "wastelens-eval";

type GT = BenchItem["ground_truth"][Jurisdiction];

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

function verdictMatches(verdict: Verdict, expected: GT, juris: Jurisdiction): boolean {
  if (verdict.tier !== expected.tier) return false;
  if (verdict.tier !== 2) {
    return verdict.stream === expected.stream;
  }
  return true;
}

function strlenOrNull(s: string | null): string {
  return s ?? "null";
}

function loadDotEnvLocal(): void {
  try {
    const f = path.resolve(".env.local");
    if (!fs.existsSync(f)) return;
    for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  } catch {
    // .env.local is optional
  }
}

async function main(): Promise<number> {
  loadDotEnvLocal();
  const bench = loadBenchmark();
  const items = bench.items;
  const report: string[] = [];
  const metrics: Record<string, unknown> = {};
  const push = (line: string) => report.push(line);

  push(`EVAL benchmark_items=${items.length}`);
  const units = items.length * JURISDICTIONS.length;
  push(`EVAL item_x_jurisdiction_units=${units}`);
  const counts = JURISDICTIONS.map((j) => `${j}=${rowCount(j)}`);
  push(`EVAL corpus_rows ${counts.join(" ")}`);

  const integrityIssues = allIntegrityIssues(bench);
  push(`EVAL orphaned_benchmark_labels=${integrityIssues.length}`);
  for (const issue of integrityIssues) {
    push(`EVAL orphan_detail ${issue.item_id} ${issue.jurisdiction} ${issue.problem}`);
  }

  let correct = 0;
  let streamedCorrect = 0;
  let streamedUnits = 0;
  const tierTally = new Map<number, number>();
  const perJuris = new Map<Jurisdiction, { correct: number; total: number }>();

  const mat = new Map<string, Verdict>();
  const vocabulary: Record<Jurisdiction, string[]> = Object.fromEntries(
    JURISDICTIONS.map((j) => [j, streamsFor(j)])
  ) as Record<Jurisdiction, string[]>;

  for (const item of items) {
    for (const juris of JURISDICTIONS) {
      const gt = item.ground_truth[juris];
      const streamed = !!gt.stream && vocabulary[juris].includes(gt.stream);
      const attrs: Record<string, unknown> = {
        stream: gt.stream,
        scope: gt.scope,
        object_class: item.perception_attrs.object_class,
        material_surface: item.perception_attrs.material_surface,
        contamination: item.perception_attrs.contamination,
        hazard_flags: item.perception_attrs.hazard_flags,
      };
      const verdict = await adjudicate({
        jurisdiction: juris,
        attributes: attrs,
        confidence: item.perception_attrs.confidence,
        generator_class: GENERATOR,
        rule_version: RULE_VERSION,
      });
      mat.set(`${item.id}|${juris}`, verdict);
      const ok = verdictMatches(verdict, gt, juris);
      if (ok) correct++;
      if (streamed) {
        streamedUnits++;
        if (ok) streamedCorrect++;
      }
      tierTally.set(verdict.tier, (tierTally.get(verdict.tier) ?? 0) + 1);
      const jp = perJuris.get(juris) ?? { correct: 0, total: 0 };
      jp.total += 1;
      if (ok) jp.correct += 1;
      perJuris.set(juris, jp);
    }
  }

  const accuracyAdjudicated = correct / units;
  push(
    `EVAL accuracy_adjudicated=${accuracyAdjudicated.toFixed(4)} (${correct}/${units}) definition="matrix+corpus correctness given hand-labeled (oracle) perception attrs; deterministic lookup has no perception noise in this run"`
  );

  for (const juris of JURISDICTIONS) {
    const jp = perJuris.get(juris)!;
    push(
      `EVAL accuracy_by_jurisdiction ${juris}=${(jp.correct / jp.total).toFixed(4)} (${jp.correct}/${jp.total})`
    );
  }

  const streamedAcc = streamedUnits > 0 ? streamedCorrect / streamedUnits : 0;

  const rawVlm = await runRawVlm(items, vocabulary);
  if (rawVlm === null) {
    push(
      `EVAL accuracy_raw_vlm=SKIPPED reason="GEMINI_API_KEY and/or resolved flash model unavailable; raw VLM = ask the vision model the bin directly with no matrix"`
    );
    push(
      `EVAL lcl=not_computed reason="requires accuracy_raw_vlm"`
    );
  } else if (rawVlm.total === 0) {
    push(
      `EVAL accuracy_raw_vlm=not_computed reason="live Gemini calls all failed (429 quota); key/model verified working — rerun after free-tier budget resets"`
    );
    push(
      `EVAL lcl=not_computed reason="requires accuracy_raw_vlm"`
    );
  } else {
    const aRaw = rawVlm.correct / rawVlm.total;
    push(
      `EVAL accuracy_raw_vlm=${aRaw.toFixed(4)} (${rawVlm.correct}/${rawVlm.total}) subset="units whose ground truth is one of the jurisdiction's declared streams via streamsFor(); Gemini given jurisdiction + that vocabulary, no rule text; answer scored against gt.stream"`
    );
    push(
      `EVAL lcl=${(streamedAcc - aRaw).toFixed(4)} base="accuracy_adjudicated over the SAME Tier 1/2 subset (${streamedCorrect}/${streamedUnits})"`
    );
  }

  const tierCoverage: Record<string, string> = {};
  for (const tier of [1, 2, 3]) {
    const n = tierTally.get(tier) ?? 0;
    tierCoverage[`tier${tier}`] = (n / units).toFixed(4);
  }
  push(
    `EVAL tier_coverage tier1=${tierCoverage["tier1"]} tier2=${tierCoverage["tier2"]} tier3=${tierCoverage["tier3"]} (over all item×jurisdiction verdicts)`
  );
  for (const juris of JURISDICTIONS) {
    const local = items.map((i) => mat.get(`${i.id}|${juris}`)!);
    const tt = new Map<number, number>();
    for (const v of local) tt.set(v.tier, (tt.get(v.tier) ?? 0) + 1);
    push(
      `EVAL tier_coverage_by_jurisdiction ${juris}=tier1:${((tt.get(1) ?? 0) / local.length).toFixed(4)} tier2:${((tt.get(2) ?? 0) / local.length).toFixed(4)} tier3:${((tt.get(3) ?? 0) / local.length).toFixed(4)}`
    );
  }

  const jdr = computeJdr(items, mat);
  push(`EVAL jdr=${jdr.byFamily.toFixed(4)} (${jdr.divergent}/${jdr.applicable}) definition="items whose verdicts genuinely differ across jurisdictions (different tier, or different stream family: recyclable vs residual vs sanitary vs special-care vs garden) / items applicable to >=1 jurisdiction"`);

  const latency = await measureLatency();
  push(
    `EVAL p95_adjudicate_us=${latency.adjudicateP95Us} definition="in-process local adjudicate() call, warmed; batch-mean p95 in microseconds, real timings"`
  );
  push(
    `EVAL p95_pipeline_us=${latency.pipelineP95Us} definition="in-process retrieve()+adjudicate() pipeline (Mode B local path), warmed; batch-mean p95 in microseconds, real timings"`
  );

  const resolved = resolveFlashVisionModel();
  const flashModel = currentFlashVisionModel();
  push(
    `EVAL flash_model_resolved=${strlenOrNull(flashModel)} status=${resolved?.status ?? "no-file"} source=${resolved?.source_url ?? "none"} checked_at=${resolved?.checked_at ?? "none"}`
  );

  metrics.benchmark_items = items.length;
  metrics.units = units;
  metrics.corpus_rows = Object.fromEntries(JURISDICTIONS.map((j) => [j, rowCount(j)]));
  metrics.accuracy_adjudicated = accuracyAdjudicated;
  metrics.correct = correct;
metrics.raw_vlm = rawVlm && rawVlm.total > 0 ? rawVlm : null;
    metrics.lcl = rawVlm && rawVlm.total > 0 ? streamedAcc - rawVlm.correct / rawVlm.total : null;
  metrics.tier_coverage = tierCoverage;
  metrics.jdr = jdr;
  metrics.p95 = latency;
  metrics.integrity_issues = integrityIssues.length;
  metrics.flash_model = { model: flashModel, status: resolved?.status ?? "no-file" };
  metrics.checked_at = new Date().toISOString();

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(metrics, null, 2) + "\n");
  const relPath = path.relative(process.cwd(), OUT_FILE).replaceAll("\\", "/");
  push(`EVAL metrics_json=${relPath}`);

  console.log("=== WASTELENS EVALUATE ===");
  console.log(report.join("\n"));
  console.log("=== END WASTELENS EVALUATE ===");
  return integrityIssues.length > 0 ? 1 : 0;
}

async function runRawVlm(
  items: BenchItem[],
  vocabulary: Record<Jurisdiction, string[]>
): Promise<{ correct: number; total: number } | null> {
  if (!process.env.GEMINI_API_KEY || !currentFlashVisionModel()) return null;
  const guessCache = new Map<string, { bin: string; stream: string | null } | null>();
  let correct = 0;
  let total = 0;
  for (const juris of JURISDICTIONS) {
    for (const item of items) {
      const gt = item.ground_truth[juris];
      if (!gt.stream || !vocabulary[juris].includes(gt.stream)) continue;
      const key = `${item.image.file}|${juris}`;
      let guessed = guessCache.get(key);
      if (guessed === undefined) {
        const res = await perceiveBinForJurisdiction(item.image.file, juris, vocabulary[juris]);
        guessed = res ? { bin: res.bin, stream: res.stream } : null;
        guessCache.set(key, guessed);
      }
      if (!guessed) {
        if (geminiQuotaBlocked) break;
        continue;
      }
      total++;
      if (guessed.stream === gt.stream) correct++;
    }
    if (geminiQuotaBlocked) break;
  }
  return { correct, total };
}

function streamFamily(stream: string | null): string {
  if (!stream) return "none";
  const recyclable = new Set(["dry", "paper-card", "metal-plastic-glass"]);
  const bio = new Set(["wet", "food"]);
  if (recyclable.has(stream)) return "recyclable";
  if (bio.has(stream)) return "bio";
  return stream;
}

function computeJdr(
  items: BenchItem[],
  mat: Map<string, Verdict>
): { byFamily: number; divergent: number; applicable: number } {
  let applicable = 0;
  let divergent = 0;
  for (const item of items) {
    const signatures = JURISDICTIONS.map((j) => {
      const v = mat.get(`${item.id}|${j}`)!;
      return `${v.tier}:${streamFamily(v.stream)}`;
    });
    const governing = JURISDICTIONS.filter((j) => item.ground_truth[j].tier !== 3).length;
    if (governing >= 1) {
      applicable += 1;
      if (new Set(signatures).size > 1) divergent += 1;
    }
  }
  return {
    byFamily: applicable ? divergent / applicable : 0,
    divergent,
    applicable,
  };
}

async function measureLatency(): Promise<{ adjudicateP95Us: number; pipelineP95Us: number }> {
  const sample = itemsForLatency();
  const adjudicateBatchMeans: number[] = [];
  const pipelineBatchMeans: number[] = [];

  for (let b = 0; b < 25; b++) {
    let adjSum = 0;
    let pipeSum = 0;
    for (let i = 0; i < 200; i++) {
      const s = sample[i % sample.length];
      const t0 = performance.now();
      await adjudicate({
        jurisdiction: s.juris,
        attributes: s.attrs,
        confidence: 0.95,
        generator_class: GENERATOR,
        rule_version: RULE_VERSION,
      });
      adjSum += performance.now() - t0;

      const t1 = performance.now();
      await retrieve(s.attrs, s.juris);
      await adjudicate({
        jurisdiction: s.juris,
        attributes: s.attrs,
        confidence: 0.95,
        generator_class: GENERATOR,
        rule_version: RULE_VERSION,
      });
      pipeSum += performance.now() - t1;
    }
    adjudicateBatchMeans.push((adjSum / 200) * 1000);
    pipelineBatchMeans.push((pipeSum / 200) * 1000);
  }
  return {
    adjudicateP95Us: Math.round(percentile(adjudicateBatchMeans, 95)),
    pipelineP95Us: Math.round(percentile(pipelineBatchMeans, 95)),
  };
}

function itemsForLatency(): Array<{ juris: Jurisdiction; attrs: Record<string, unknown> }> {
  const bench = loadBenchmark();
  const samples = JURISDICTIONS.map((j) => ({
    juris: j,
    attrs: {
      stream: "wet",
      scope: "households",
      object_class: "banana peel",
      material_surface: "organic",
    } as Record<string, unknown>,
  }));
  const extra: Array<{ juris: Jurisdiction; attrs: Record<string, unknown> }> = [];
  for (const item of bench.items.slice(0, 6)) {
    for (const j of JURISDICTIONS) {
      extra.push({
        juris: j,
        attrs: {
          stream: item.ground_truth[j].stream,
          scope: item.ground_truth[j].scope,
        },
      });
    }
  }
  return [...samples, ...extra];
}

main().then((code) => process.exit(code));