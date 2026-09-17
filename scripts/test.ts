import { adjudicate } from "../lib/matrix";
import { localVerdict } from "../lib/localVerdict";
import {
  createVerdictController,
  PerceptionOutcome,
} from "../lib/verdictState";
import { candidateStreams } from "../lib/attributeMapper";
import { CORPORA, JURISDICTIONS, streamsFor } from "../lib/corpus";
import {
  allIntegrityIssues,
  loadBenchmark,
  BenchItem,
} from "../lib/benchmarkIntegrity";
import { perceive as realPerceive } from "../lib/perception";
import indiaRules from "../data/jurisdictions/india/rules.json";
import nycRules from "../data/jurisdictions/nyc/rules.json";
import englandRules from "../data/jurisdictions/england/rules.json";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    console.log(`  FAIL: ${message}`);
  }
}

async function sameVerdict(a: any, b: any): Promise<boolean> {
  return (
    a.tier === b.tier &&
    a.clause_id === b.clause_id &&
    a.source_url === b.source_url &&
    a.stream === b.stream
  );
}

async function determinismTests() {
  console.log("=== Determinism: identical input -> identical verdict ===");
  for (const juris of JURISDICTIONS) {
    const attrs =
      juris === "india"
        ? { stream: "wet", scope: "households" }
        : juris === "nyc"
          ? { stream: "food", scope: "households" }
          : { stream: "food", scope: "households" };
    const v1 = await adjudicate({
      jurisdiction: juris,
      attributes: attrs,
      confidence: 0.95,
      generator_class: "wastelens-v1",
      rule_version: "1.0",
    });
    const v2 = await adjudicate({
      jurisdiction: juris,
      attributes: attrs,
      confidence: 0.95,
      generator_class: "wastelens-v1",
      rule_version: "1.0",
    });
    assert(
      await sameVerdict(v1, v2),
      `determinism ${juris}: stable across calls (tier ${v1.tier}, ${v1.clause_id})`
    );
  }
}

async function tierLogicTests() {
  console.log("\n=== Tier logic across all three jurisdictions ===");
  const india = await adjudicate({
    jurisdiction: "india",
    attributes: { stream: "sanitary", scope: "households" },
    confidence: 0.95,
    generator_class: "test",
    rule_version: "1.0",
  });
  assert(india.tier === 1 && india.clause_id === "SWM2026-san-hh", "india sanitary households -> Tier 1 SWM2026-san-hh");

  const indiaUnknown = await adjudicate({
    jurisdiction: "india",
    attributes: { stream: "construction-debris" },
    confidence: 0.9,
    generator_class: "test",
    rule_version: "1.0",
  });
  assert(
    indiaUnknown.tier === 3 && (indiaUnknown.guidance ?? "").includes("no fine asserted"),
    "india unrecognized stream -> Tier 3 with explicit 'no fine asserted'"
  );

  const nyc = await adjudicate({
    jurisdiction: "nyc",
    attributes: { stream: "paper-card", scope: "households" },
    confidence: 0.99,
    generator_class: "test",
    rule_version: "1.0",
  });
  assert(nyc.tier === 1 && nyc.clause_id === "NYC2024-paper-hh", "nyc paper-card households -> Tier 1 NYC2024-paper-hh");

  const nycT2 = await adjudicate({
    jurisdiction: "nyc",
    attributes: { stream: "food" },
    confidence: 0.99,
    generator_class: "test",
    rule_version: "1.0",
  });
  assert(nycT2.tier === 2 && (nycT2.question ?? "").includes("scope"), "nyc food without scope -> Tier 2 clarify");

  const england = await adjudicate({
    jurisdiction: "england",
    attributes: { stream: "garden", scope: "households" },
    confidence: 0.99,
    generator_class: "test",
    rule_version: "1.0",
  });
  assert(england.tier === 1 && england.clause_id === "ENG2025-garden-hh", "england garden households -> Tier 1 ENG2025-garden-hh");

  const englandPaper = await adjudicate({
    jurisdiction: "england",
    attributes: { stream: "paper-card", scope: "households" },
    confidence: 0.99,
    generator_class: "test",
    rule_version: "1.0",
  });
  assert(englandPaper.tier === 1 && englandPaper.clause_id === "ENG2025-paper-hh", "england paper-card households -> Tier 1 ENG2025-paper-hh");

  const lowConfidence = await adjudicate({
    jurisdiction: "india",
    attributes: { stream: "dry", scope: "households" },
    confidence: 0.6,
    generator_class: "test",
    rule_version: "1.0",
  });
  assert(lowConfidence.tier === 2, "confidence 0.6 -> Tier 2 clarify rather than guess");
}

async function noReperceiveOnToggle() {
  console.log("\n=== Architecture Rule: perception cached across jurisdiction switch ===");
  let perceiveCalls = 0;
  const fakePerceive = async (imageRef: string): Promise<PerceptionOutcome> => {
    perceiveCalls++;
    return {
      output: {
        object_class: "banana peel",
        material_surface: "organic",
        contamination: false,
        hazard_flags: [],
        confidence: 0.97,
      },
      model_id: "fake-local",
    };
  };
  const ctl = createVerdictController(fakePerceive);
  await ctl.perceiveImage("sample://banana");
  assert(perceiveCalls === 1, `one perception for first image (calls=${perceiveCalls})`);

  await ctl.selectJurisdiction("india", "households");
  await ctl.selectJurisdiction("nyc", "households");
  await ctl.selectJurisdiction("england", "households");
  await ctl.selectJurisdiction("india", "households");
  await ctl.perceiveImage("sample://banana");
  assert(
    perceiveCalls === 1,
    `no re-perceive on jurisdiction switch or repeat image (calls=${perceiveCalls})`
  );

  const state = ctl.getState();
  assert(state.verdicts.india?.tier === 1, "india verdict cached for banana peel");
  assert(state.verdicts.india?.stream === "wet", "india banana peel -> wet stream via mapper");
  assert(state.verdicts.nyc?.stream === "food", "nyc banana peel -> food stream via mapper");

  await ctl.perceiveImage("sample://paint-can");
  assert(perceiveCalls === 2, "new image triggers exactly one new perception");
  const state2 = ctl.getState();
  assert(state2.perceiveInvocations === 2, "perceiveInvocations tracks exactly 2");
}

async function modeBNetworkDisabled() {
  console.log("\n=== Mode B: local rules.json -> matrix with network disabled ===");
  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((() => {
    fetchCalls++;
    throw new Error("network disabled in Mode B test");
  }) as unknown) as typeof fetch;

  const results = await Promise.all(
    JURISDICTIONS.map((juris) =>
      localVerdict({
        jurisdiction: juris,
        attributes:
          juris === "india"
            ? { stream: "wet", scope: "households" }
            : { stream: "food", scope: "households" },
        confidence: 0.95,
        generator_class: "test",
        rule_version: "1.0",
      })
    )
  );
  globalThis.fetch = originalFetch;

  assert(fetchCalls === 0, `zero network calls during Mode B (fetchCalls=${fetchCalls})`);
  assert(results.length === 3 && results.every((r) => !r.used_network), "all Mode B runs used_network=false");
  assert(results.every((r) => r.verdict.tier >= 1 && r.verdict.tier <= 3), "all Mode B runs produced a valid verdict");
  assert(
    results.every((r) => r.verdict.tier === 1),
    "local known-attribute path resolves Tier 1 in all three jurisdictions"
  );
}

async function benchmarkIntegrityTests() {
  console.log("\n=== Benchmark label integrity ===");
  const bench = loadBenchmark();
  assert(bench.items.length >= 20 && bench.items.length <= 28, `benchmark size ${bench.items.length} in [20,28]`);
  assert(bench.hand_labeled_before_eval === true, "labels declared hand-labeled before evaluate");

  const issues = allIntegrityIssues(bench);
  assert(issues.length === 0, `zero orphaned ground-truth labels (issues=${issues.length})`);
  for (const issue of issues.slice(0, 5)) {
    console.log(`    ORPHAN ${issue.item_id} ${issue.jurisdiction} ${issue.problem}`);
  }

  function streamFamily(stream: string | null): string {
    if (!stream) return "none";
    const recyclable = new Set(["dry", "paper-card", "metal-plastic-glass"]);
    const bio = new Set(["wet", "food"]);
    if (recyclable.has(stream)) return "recyclable";
    if (bio.has(stream)) return "bio";
    return stream;
  }
  const divergent = bench.items.filter((it) => {
    const sigs = JURISDICTIONS.map((j) => `${it.ground_truth[j].tier}:${streamFamily(it.ground_truth[j].stream)}`);
    return new Set(sigs).size > 1;
  });
  const noMatchEverywhere = bench.items.filter(
    (it) => JURISDICTIONS.every((j) => it.ground_truth[j].tier === 3)
  );
  assert(divergent.length >= 3, `>=3 divergent-across-jurisdiction items (found ${divergent.length})`);
  assert(noMatchEverywhere.length >= 2 && noMatchEverywhere.length <= 3, `2-3 no-match-anywhere items (found ${noMatchEverywhere.length})`);
  assert(
    bench.items.filter((it) => it.composition_role === "ambiguous").length >= 3,
    ">=3 ambiguous items exercise Tier 2"
  );

  const unknown = bench.items.filter((it) => (it as any).imageUrl);
  assert(unknown.length === 0, "no invented imageUrl fields");

  console.log("  Divergent items: " + divergent.map((d) => d.id).join(", "));
  console.log("  No-match-anywhere items: " + noMatchEverywhere.map((d) => d.id).join(", "));
}

async function mapperTests() {
  console.log("\n=== Mapper: perception -> per-jurisdiction stream ===");
  const banana = candidateStreams(
    { object_class: "banana peel", material_surface: "organic", contamination: false, hazard_flags: [], confidence: 0.97 },
    "india"
  )[0];
  assert(banana.stream === "wet", `banana in india -> wet (got ${banana.stream})`);

  const emptyPaintNyc = candidateStreams(
    { object_class: "paint can", material_surface: "metal", contamination: false, hazard_flags: ["paint-residue"], confidence: 0.92 },
    "nyc"
  )[0];
  assert(
    emptyPaintNyc.stream === "metal-plastic-glass",
    `empty/dry paint can in nyc -> metal-plastic-glass per DSNY (got ${emptyPaintNyc.stream})`
  );

  const wetPaintNyc = candidateStreams(
    { object_class: "paint can", material_surface: "metal", contamination: false, hazard_flags: ["paint-residue", "wet-paint"], confidence: 0.9 },
    "nyc"
  )[0];
  assert(
    wetPaintNyc.stream === "special-care",
    `wet/partial paint can in nyc -> special-care (got ${wetPaintNyc.stream})`
  );

  const paintIndia = candidateStreams(
    { object_class: "paint can", material_surface: "metal", contamination: false, hazard_flags: ["paint-residue"], confidence: 0.92 },
    "india"
  )[0];
  assert(
    paintIndia.stream === "special-care",
    `paint can in india stays special-care (SWM2026-spc-hh) (got ${paintIndia.stream})`
  );

  const grass = candidateStreams(
    { object_class: "grass clippings", material_surface: "organic", contamination: false, hazard_flags: [], confidence: 0.94 },
    "england"
  )[0];
  assert(grass.stream === "garden", `grass in england -> garden (got ${grass.stream})`);

  const battery = candidateStreams(
    { object_class: "car battery", material_surface: "plastic", contamination: false, hazard_flags: ["battery", "corrosive"], confidence: 0.96 },
    "india"
  )[0];
  assert(battery.stream === "hazardous", `car battery -> hazardous, not wet/dry (got ${battery.stream})`);
}

async function corpusSchemaTests() {
  console.log("\n=== Corpus schema: one unified shape across all three files ===");
  const files: Array<[string, unknown]> = [
    ["india/rules.json", indiaRules],
    ["nyc/rules.json", nycRules],
    ["england/rules.json", englandRules],
  ];
  const rowKeys = [
    "jurisdiction",
    "clause_id",
    "stream",
    "source_url",
    "effective_date",
    "date_precision",
    "scope",
    "fine_bracket",
    "exemptions",
    "verification_status",
    "rule_text",
    "citation_precision",
  ];
  for (const [file, raw] of files) {
    assert(!Array.isArray(raw), `${file} is a single { jurisdiction, ..., rows } wrapper object, not a flat array`);
    const wrapped = raw as { rows?: unknown[] };
    assert(Array.isArray(wrapped.rows), `${file} exposes a rows[] array`);
    assert(wrapped.rows!.length >= 8, `${file} has >=8 rows (${wrapped.rows!.length})`);
    for (const row of wrapped.rows! as Array<Record<string, unknown>>) {
      for (const key of rowKeys) {
        assert(key in row, `${file}/${String(row.clause_id)} has field ${key}`);
      }
      const dp = row.date_precision;
      assert(dp === "exact" || dp === "year", `${file}/${String(row.clause_id)} date_precision is "exact" or "year"`);
      if (dp === "year") {
        assert(
          /^\d{4}$/.test(String(row.effective_date)),
          `${file}/${String(row.clause_id)} year-precision effective_date is a bare year (got "${row.effective_date}")`
        );
      } else {
        assert(
          /^\d{4}-\d{2}-\d{2}$/.test(String(row.effective_date)),
          `${file}/${String(row.clause_id)} exact-precision effective_date is ISO (got "${row.effective_date}")`
        );
      }
    }
  }

  const englandRows = (englandRules as { rows: Array<Record<string, unknown>> }).rows;
  for (const row of englandRows) {
    const household = row.scope === "households";
    const expected = household ? "2026-03-31" : "2025-03-31";
    assert(
      row.effective_date === expected,
      `england/${row.clause_id} (${row.scope}) effective_date=${row.effective_date} (household=2026-03-31, commercial=2025-03-31)`
    );
    if (household) {
      const exemptions = row.exemptions as Array<{ condition?: string }> | null;
      const hasMicroFirm = Array.isArray(exemptions) && exemptions.some((e) => e.condition?.includes("micro-firm"));
      assert(!hasMicroFirm, `england/${row.clause_id} household row carries no micro-firm exemption (business-only concept)`);
    }
  }

  const nycRows = (nycRules as { rows: Array<Record<string, unknown>> }).rows;
  for (const row of nycRows) {
    const dryStreams = ["paper-card", "metal-plastic-glass", "residual"];
    if (dryStreams.includes(String(row.stream))) {
      const src = String(row.source_url);
      assert(!src.includes("organics"), `nyc/${row.clause_id} does not cite the organics PDF (distinct legal basis: 16 RCNY Ch.1/Local Law 19)`);
    }
  }
}

async function corpusConsumptionTests() {
  console.log("\n=== Corpus consumption (all three jurisdictions readable, null-safe) ===");
  for (const juris of JURISDICTIONS) {
    assert(CORPORA[juris].length >= 8, `${juris} corpus has >=8 rows (${CORPORA[juris].length})`);
    for (const row of CORPORA[juris]) {
      assert(!!row.rule_text, `${juris}/${row.clause_id} has rule_text`);
      assert(!!row.source_url, `${juris}/${row.clause_id} has source_url`);
    }
    assert(streamsFor(juris).length >= 4, `${juris} exposes >=4 streams`);
  }
  const realPerception = await realPerceive("data/benchmark_images/B05.svg");
  assert(realPerception.output === null, "real perceive without model weights/key returns honest failure (no fabricated output)");
  console.log(`    INFO: real perceive -> ${JSON.stringify((realPerception as any).error?.slice(0, 90) ?? "n/a")}`);
}

const benchItems: BenchItem[] = loadBenchmark().items;
async function tscSanity() {
  assert(benchItems.length === 27, `expected 27 benchmark items, got ${benchItems.length}`);
}

async function main() {
  delete process.env.GEMINI_API_KEY;
  delete process.env.WASTELENS_MODELS_DIR;
  await tscSanity();
  await determinismTests();
  await tierLogicTests();
  await noReperceiveOnToggle();
  await modeBNetworkDisabled();
  await benchmarkIntegrityTests();
  await mapperTests();
  await corpusSchemaTests();
  await corpusConsumptionTests();

  console.log(`\n=== TEST RESULTS: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});