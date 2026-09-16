# WasteLens Global

A statutory waste-compliance decision system built for NextStep Hacks 2026 (Earth Forward).

**Perception proposes. The law decides.**

## Stack

- Next.js 15 + React 19 + TypeScript + Tailwind CSS
- Supabase (auth + postgres + pgvector + storage)
- YOLO12n / RF-DETR-base (vision) + Gemini 2.5 Flash fallback
- Claude 3.5 Sonnet (explanation)
- Deployed on Vercel

## Quick Start

```bash
npm install
npm run dev
```

## Scripts

- `npm run evaluate` — produces LCL, JDR, tier coverage, p95 metrics
- `npm run verify-rules` — cross-checks corpus rows against primary-source URLs
- `npm run ingest` — builds retrieval corpus from `data/jurisdictions/`

## Corpus

- India: SWM Rules 2026 (S.O. 388(E), effective 1 Apr 2026)
- NYC: Local Law 85 (2023) + Title 16 + Admin Code §16-324
- England: EPA 1990 ss.45A/45AZA/45AZB + Separation of Waste Regulations 2025 (SI 2025/140)

All corpus rows are hand-verified against primary sources. See `docs/evidence/statutory-mapping.md`.

## License

MIT
