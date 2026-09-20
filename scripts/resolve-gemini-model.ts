import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const SOURCE_URL = "https://ai.google.dev/gemini-api/docs/models";
const OUT_FILE = path.resolve("data/generated/flash_vision_model.json");
const MODEL_ID_RE = /gemini-\d+(?:\.\d+){1,2}(?:\.\d+)?-flash(?:-[a-z0-9-]+)*/gi;
const EXCLUDE = /(preview|lite|image|cyber|experimental|flash%-)/i;

function parseModelIds(html: string): string[] {
  const seen = new Set<string>();
  for (const m of html.matchAll(MODEL_ID_RE)) {
    const id = m[0].toLowerCase();
    if (!EXCLUDE.test(id)) seen.add(id);
  }
  return Array.from(seen);
}

function versionOf(id: string): number[] {
  const m = id.match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  return m ? [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)] : [0, 0, 0];
}

function pickFlashModel(ids: string[]): string | null {
  if (ids.length === 0) return null;
  const tallied = new Map<string, number>();
  for (const id of ids) {
    const base = id.replace(/-flash.*$/, "-flash");
    tallied.set(base, (tallied.get(base) ?? 0) + 1);
  }
  const sorted = Array.from(tallied.entries()).sort((a, b) => {
    const va = versionOf(a[0]);
    const vb = versionOf(b[0]);
    for (let i = 0; i < 3; i++) {
      if (va[i] !== vb[i]) return vb[i] - va[i];
    }
    return 0;
  });
  return sorted[0]?.[0] ?? null;
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)
  );
  return Promise.race([fetch(url), timeout]);
}

async function main(): Promise<number> {
  mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  const checked_at = new Date().toISOString();
  try {
    const res = await fetchWithTimeout(SOURCE_URL, 15_000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const ids = parseModelIds(html);
    const chosen = pickFlashModel(ids);
    const record = {
      status: chosen ? ("ok" as const) : ("unreachable" as const),
      chosen,
      candidates: ids,
      source_url: SOURCE_URL,
      checked_at,
      reason: chosen
        ? "current Flash-tier line from ai.google.dev models page"
        : "no Flash-tier model ids found on page",
    };
    writeFileSync(OUT_FILE, JSON.stringify(record, null, 2) + "\n");
    console.log(`RESOLVE status=${record.status} chosen=${record.chosen}`);
    console.log(`RESOLVE candidates=${JSON.stringify(ids)}`);
    console.log(`RESOLVE written=${OUT_FILE}`);
    return 0;
  } catch (err) {
    const record = {
      status: "unreachable" as const,
      chosen: null,
      candidates: [] as string[],
      source_url: SOURCE_URL,
      checked_at,
      reason: (err as Error).message,
    };
    writeFileSync(OUT_FILE, JSON.stringify(record, null, 2) + "\n");
    console.log(`RESOLVE status=unreachable reason=${record.reason}`);
    console.log(`RESOLVE written=${OUT_FILE} exit=0 build-continues (stale record preferred over a failed deploy)`);
    return 0;
  }
}

main().then((code) => process.exit(code));