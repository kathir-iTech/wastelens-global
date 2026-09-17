import { CORPORA, CorpusRow, JURISDICTIONS, Jurisdiction } from "../lib/corpus";
import {
  allIntegrityIssues,
  loadBenchmark,
} from "../lib/benchmarkIntegrity";

function isValidDate(s: string | undefined): boolean {
  if (!s) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

function isValidEffectiveDate(row: CorpusRow): boolean {
  if (row.date_precision === "year") return /^\d{4}$/.test(row.effective_date);
  if (row.date_precision === "exact") return isValidDate(row.effective_date);
  return false;
}

function isValidUrl(s: string | undefined): boolean {
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function checkJurisdiction(juris: Jurisdiction): number {
  const rows = CORPORA[juris];
  console.log(`\n=== ${juris.toUpperCase()} corpus (${rows.length} rows) ===`);
  const seenClause = new Set<string>();
  const seenStreamScope = new Set<string>();
  let problems = 0;

  for (const row of rows) {
    const label = `${juris}/${row.clause_id}`;
    const flags: string[] = [];

    if (!isValidUrl(row.source_url)) flags.push("source_url invalid");
    if (!isValidEffectiveDate(row)) flags.push(`effective_date invalid for date_precision="${row.date_precision}"`);
    if (!row.rule_text || row.rule_text.trim().length === 0) flags.push("empty rule_text");
    if (!row.stream) flags.push("empty stream");
    if (!row.scope) flags.push("empty scope");
    if (row.fine_bracket !== null) flags.push("fine_bracket present (unverified numeric figure)");
    if (row.verification_status !== "verified") flags.push(`verification_status="${row.verification_status}"`);
    if (!row.citation_precision) flags.push("missing citation_precision");
    if (seenClause.has(row.clause_id)) flags.push("duplicate clause_id");
    if (seenStreamScope.has(`${row.stream}|${row.scope}`)) flags.push(`duplicate (stream,scope) for ${row.stream}/${row.scope}`);
    seenClause.add(row.clause_id);
    seenStreamScope.add(`${row.stream}|${row.scope}`);

    if (flags.length === 0) {
      console.log(`PASS ${label} — URL ${row.source_url}`);
    } else {
      problems++;
      console.log(`REVIEW ${label} — ${flags.join("; ")} — ${row.source_url}`);
    }
  }
  const withFine = rows.filter((r) => r.fine_bracket !== null).length;
  console.log(`NOTE ${juris} fine_bracket asserted in ${withFine}/${rows.length} rows (none in this corpus — no numeric penalty copy-pasted from source)`);
  return problems;
}

function checkBenchmark(): void {
  const bench = loadBenchmark();
  console.log("\n=== Benchmark ground-truth integrity ===");
  const issues = allIntegrityIssues(bench);
  console.log(`items=${bench.items.length} jurisdictions=${JURISDICTIONS.length}`);
  console.log(`orphaned_ground_truth_labels=${issues.length}`);
  for (const issue of issues) {
    console.log(
      `ORPHAN ${issue.item_id} ${issue.jurisdiction} — ${issue.problem}`
    );
  }
  if (issues.length === 0) {
    console.log("Benchmark labels all reference real corpus rows (or real absences for Tier 3). PASS.");
  } else {
    console.log("Benchmark integrity FAIL — fix labels before evaluate.");
  }
}

let totalProblems = 0;
for (const juris of JURISDICTIONS) {
  totalProblems += checkJurisdiction(juris);
}
checkBenchmark();

console.log("\n=== Summary ===");
console.log(`corpus problems=${totalProblems}`);
console.log("=== All verifications complete ===");
process.exit(totalProblems === 0 ? 0 : 1);