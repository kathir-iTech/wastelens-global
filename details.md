# WasteLens Global — Project Reference

Living project document. Every claim below was verified against the repository or by direct command output; nothing is remembered-from-hype. Companion diagram file: `details.mmd`.

Last refreshed: 2026-09-19 — P0 demo-survival round (model fallback chain, cached-sample fallback, build-resilience, fetch-patch removal).

---

## 1. Thesis and product shape

- Every final ruling is a **deterministic matrix lookup** against a hand-verified corpus row. Rule text is corpus text, never model-generated prose.
- One photograph yields **three rulings** (India / NYC / England). Perception runs exactly once per image; the matrix re-runs per jurisdiction (perception count is asserted `= 1` across jurisdiction switches in tests).
- Mode A = snapshot perception (Gemini). Mode B = known attributes, resolved fully on-device (zero network). Mode C = the 12-case gallery docket, pre-adjudicated by the matrix, zero network.
- UI: camera-first ("Photograph waste, get the statute."). Dark aurora + glassmorphic visual pass (lucide-react icons, backdrop blur, `animate-rise`/`animate-drift` with `prefers-reduced-motion` guards).

## 2. Stack (verified from package.json)

- Next.js **15.3.9**, React **19.1.0**, TypeScript, Tailwind **4**, `lucide-react`, `clsx`, `tailwind-merge`.
- No database, no pgvector, no Supabase, no shadcn, no embeddings. Corpus is static JSON under `data/jurisdictions/`. Deploy target: **Vercel**.
- Data generation (`data/generated/`) is gitignored and produced at build time.

## 3. Perception pipeline (`lib/perception.ts`) — P0 hardened

- Model chain: **`gemini-3.8-flash` → `gemini-3.1-flash-lite` → `gemini-3.5-flash`**, tried in order on any failure/429/timeout.
- **Fallback models are probe-validated** with one real image (`public/benchmark_images/B01.svg`) before being trusted — a model must return a valid `object_class`, not merely exist in the resolver list. Validation is memoized per process.
- Per-model retry: **2 attempts, 1.5s fixed backoff, 12s `AbortController` timeout**; the route exports `maxDuration = 30` (real ceiling 2×12 + 1.5 = 25.5s).
- Quota pools are **per model on the same key** — when 3.8 is over its own RPD/RPM (25/20, 8/5) but lite sits at 0/500, the chain fails over and the site keeps serving live results (proven by a real `model_id: gemini-3.1-flash-lite` success during this round).
- The raw-VLM evaluation helpers (`perceiveBinForJurisdiction`, `perceiveRawBinGeneric`) route through the same chain, so `raw_vlm`/`lcl` metrics are no longer structurally blocked on the 20-RPD pool.
- On total chain exhaustion, the live route returns a clean failure body; the client falls back to the **cached matrix verdict** (see §6) labeled `Perception offline — showing cached matrix verdict.` — never silently, never disguised as live.

## 4. Latency (real before/after, 2026-09-19)

- Quota-failure path: **20.4s BEFORE → 3.9s AFTER** the retry-bound commit (`6eccb5f`), same 429, ~5× faster. Success-path latency unmeasurable while quota pools are exhausted; re-measure when healthy.

## 5. Deterministic engine (`lib/matrix.ts`, `lib/retriever.ts`)

- Retriever weights (verified): **+40 stream, +25 scope, +10 term, +2 word**.
- Tier rules: confidence < 0.8 → Tier 2 clarify; no verified row → Tier 3 refusal; high-confidence match → Tier 1.
- **Tier 3 `fine_bracket` is structurally `null`** (matrix line 70/76). `generator_class` and `rule_version` exist in the input schema but are currently declared-and-unread — an acknowledged scope decision, not an oversight to "fix" without a decision.
- `lib/matrix.ts` is high-risk to change; any edit must clear the 488-assertion suite.

## 6. Corpus and sample data (verified)

| | rows | streams | notes |
|---|---|---|---|
| India | 8 | wet, dry, sanitary, special-care | `citation_precision` general on all 8; SWM 2026 gazette source |
| NYC | 8 | food, paper-card, metal-plastic-glass, residual | `date_precision` year×6, exact×2; Local Law 19 / 16 RCNY Ch.1 |
| England | 10 | food, garden, dry, paper-card, residual | exemptions on 6 rows; household 2026-03-31 vs business 2025-03-31 |

- `fine_bracket = null` on **all 26** rows: no fine figure ever fabricated; re-verify the primary source before adding one.
- NYC paint-can rule is encoded in `lib/attributeMapper.ts` (empty/dry → metal-plastic-glass per DSNY; wet/partial → special-care).
- Benchmark: **27 items** (`data/benchmark_set.json`), 6 divergent across jurisdictions (B12, B13, B14, B16, B20, B27), 3 no-match-anywhere (B17, B18, B19), ≥3 ambiguous.
- Sample gallery: **12 cases** (4/jurisdiction; B14 added as IN-04/NY-04/GB-04 — used diaper → India sanitary / NYC residual / England residual, all Tier 1, divergent). The gallery is *the* cached-sample fallback source.

## 7. Measure/eval numbers (2026-09-19, offline)

- `accuracy_adjudicated = 1.0000` (**81/81**) — an ORACLE self-consistency number (hand-labeled perception attrs), NOT real-world accuracy; do not quote it as such.
- `jdr = 0.25` (6/24) — jurisdiction divergence rate.
- Tier coverage: Tier1 61.7% / Tier2 18.5% / Tier3 19.8%.
- p95 adjudicate **14 µs**; p95 Mode B pipeline **51 µs** (real timings, warmed, in-process).
- `raw_vlm` / `lcl` = `not_computed` while quota dead; now addressable via the lite pool (see §3).

## 8. Build safety (P0)

- `scripts/resolve-gemini-model.ts` **no longer aborts `next build`** on a network blip during Vercel prebuild: status `unreachable` is recorded, exit code 0, build continues. A failed deploy is strictly worse than a stale model record.
- The `globalThis.fetch` monkey-patch was **removed** from `app/page.tsx`; the offline honesty readout now derives from `localVerdict()`'s own `used_network` return value. Mode B's zero-network guarantee is enforced in tests where fetch is overridden to throw.

## 9. Gate (run after every change)

`npm run typecheck` · `npm run lint` (0 warnings) · `npm run test` (**488 passed / 0 failed**) · `npx next build` (First Load JS **124 kB**). `npm run verify-rules` additionally asserts 0 corpus problems / 0 orphaned labels.

## 10. Open items (honest)

1. **Lighthouse TBT 3,540ms** [user-reported] — CDP long-task measurement (5× CPU throttle): aurora adds **2 long tasks ≈ 91ms TBT**; hidden → 0. So the aurora is real-but-small and does NOT explain 3,540ms; needs a genuine Lighthouse run (slow-4G + Moto G Power) to reproduce. Still open.
2. **`raw_vlm` / `lcl`** — now runnable via the fallback chain once the user lets the 3.8 pool rest and runs `npm run evaluate` (expect real numbers this time, not `not_computed`).
3. **`generator_class`/`rule_version` enforcement** — scope decision, not a bug.
4. **Devpost page does not exist yet** — the largest non-code gap; video rule is **≤5 min, no stated minimum** (use the more recent of the two audits).
5. P1 (post-P0): same-photo three-rulings shown side-by-side somewhere; hero/copy leads with the environmental problem, not the statute (adherence-to-track).

## 11. Rules of engagement for agents extending this project

1. Never fabricate a fine figure — re-verify the primary source text first.
2. Never invent a date more precise than what is sourced (`date_precision`/`citation_precision` exist for exactly this).
3. Treat `lib/matrix.ts` changes as high-risk; corpus content is off-limits unless explicitly asked.
4. Verification = real file contents / command output, never a narrated summary.
5. Perception fallback models must be probe-validated with a real image, never trusted by name alone.