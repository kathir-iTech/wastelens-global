# Deployment

Live URL: <https://wastelens-global.vercel.app/>

## One-time setup: link the repo to Vercel

Two equivalent paths; pick one.

**Option A — GitHub import (no local tooling):**

1. In vercel.com → Add New → Project → import `kathir-iTech/wastelens-global`.
2. Vercel auto-detects the framework as **Next.js**. Leave the build settings at defaults (framework preset: Next.js).
3. Add the environment variable (see below) before the first build.
4. Deploy. Every push to `main` redeploys automatically.

**Option B — Vercel CLI (local):**

```bash
vercel login                       # browser OAuth, one-time
vercel link                        # link this directory to the Vercel project
vercel --prod                      # production deploy
```

## Environment variable (exact name matters)

Set **one** env var in Vercel → Project → Settings → Environment Variables → Production:

```
GEMINI_API_KEY = <the Gemini API key>
```

The name must be exactly `GEMINI_API_KEY` — code reads `process.env.GEMINI_API_KEY` in
`lib/perception.ts` (Mode A live perception and raw-VLM eval). A misspelled name (for
example `GEMII_API_KEY`) compiles fine and the site still serves, but Mode A quietly
returns `"GEMINI_API_KEY not set; fallback perception unavailable"`. `curl` the page and
a real scan are the two checks that catch it.

Changing an env var does **not** hot-apply to an existing deployment — either redeploy
from the dashboard or push a commit to `main` to trigger a new build.

## Verify the deploy

```bash
# 1. HTTP status — expect 200
curl -s -o /dev/null -w "%{http_code}\n" https://wastelens-global.vercel.app/

# 2. Page content — expect the gallery + tier text to appear
curl -s https://wastelens-global.vercel.app/ | Select-String -SimpleMatch "Sample gallery"

# 3. Live perception on a real phone, on real mobile data (not localhost):
#    Mode A → pick a sample or upload a photo → Run perception →
#    wait for verdict + rule text. Expect 1–3 s for the Gemini round-trip.
```

Mode B (known attributes) and the sample gallery (12 benchmark cases; only the diaper has three-jurisdiction cached snapshots) are fully self-contained and
work without any key or network — a deploy missing the key is a partial deploy, not a
broken one, and the checks above distinguish the two.

## Safety notes

- `.env.local` is gitignored and never deployed; the Vercel env var is the only source
  for the key in production. **The exact name must be `GEMINI_API_KEY`** — a misspelled
  variant (e.g. `GEMII_API_KEY`) compiles and serves but Mode A live perception returns
  `"GEMINI_API_KEY not set; fallback perception unavailable"` (verified on the live URL).
- Fonts: IBM Plex Sans/Mono load from Google Fonts at runtime; the app shell is static
  and the layout, shapes, palette, and citations hold in the system fallback if fonts
  are unreachable.
- `npm run evaluate` talks to the Gemini API from wherever it runs (it uses a local
  `GEMINI_API_KEY`); it is not tied to this deploy.