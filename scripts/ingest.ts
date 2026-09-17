import fs from "node:fs";
import path from "node:path";
import { CORPORA, JURISDICTIONS, Jurisdiction } from "../lib/corpus";

const OUT_FILE = path.resolve("data/generated/retrieval_index.json");

function tokens(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .join(" ");
}

function main(): number {
  const index = JURISDICTIONS.map((juris) => ({
    jurisdiction: juris,
    rows: CORPORA[juris].map((row) => ({
      clause_id: row.clause_id,
      stream: row.stream,
      scope: row.scope,
      source_url: row.source_url,
      effective_date: row.effective_date,
      rule_text: row.rule_text,
      search_tokens: tokens(
        `${row.stream} ${row.scope} ${row.rule_text} ${row.clause_id}`
      ),
      fine_bracket: row.fine_bracket,
      exemptions: row.exemptions,
    })),
  }));

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify({ version: 1, built_at: new Date().toISOString(), index }, null, 2) + "\n");
  const total = index.reduce((acc, j) => acc + j.rows.length, 0);
  console.log(`INGEST built local retrieval index: ${total} rows across ${JURISDICTIONS.length} jurisdictions -> ${OUT_FILE}`);
  console.log("INGEST local-only; pgvector remote index not wired in this build (documented Mode B behavior).");
  return 0;
}

process.exit(main());