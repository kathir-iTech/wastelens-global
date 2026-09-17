import benchmarkRaw from "../data/benchmark_set.json";
import { JURISDICTIONS, Jurisdiction, streamsFor, rowsForStream } from "./corpus";

export interface GroundTruth {
  tier: 1 | 2 | 3;
  stream: string | null;
  scope: string | null;
  note?: string;
}

export interface BenchItem {
  id: string;
  label: string;
  image: { kind: string; file: string; provenance: string };
  perception_attrs: {
    object_class: string;
    material_surface: string;
    contamination: boolean;
    hazard_flags: string[];
    confidence: number;
    household_context: boolean;
  };
  ground_truth: Record<Jurisdiction, GroundTruth>;
  composition_role: string;
}

export interface BenchFile {
  version: string;
  hand_labeled_before_eval: boolean;
  sourcing_manifest: string;
  items: BenchItem[];
}

export interface IntegrityIssue {
  item_id: string;
  jurisdiction: Jurisdiction;
  problem: string;
  expected: GroundTruth;
  corpus_streams: string[];
}

const bench: BenchFile = benchmarkRaw as BenchFile;

export function loadBenchmark(): BenchFile {
  return bench;
}

export function checkBenchmarkIntegrity(item: BenchItem): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  for (const jurisdiction of JURISDICTIONS) {
    const gt = item.ground_truth[jurisdiction];
    const known = streamsFor(jurisdiction);
    if (gt.tier === 1 || gt.tier === 2) {
      if (!gt.stream) {
        issues.push({
          item_id: item.id,
          jurisdiction,
          problem: `tier ${gt.tier} label has no stream reference`,
          expected: gt,
          corpus_streams: known,
        });
        continue;
      }
      if (!known.includes(gt.stream)) {
        issues.push({
          item_id: item.id,
          jurisdiction,
          problem: `expected stream "${gt.stream}" for tier ${gt.tier} does not exist in corpus streams (${known.join(", ")})`,
          expected: gt,
          corpus_streams: known,
        });
        continue;
      }
      if (gt.tier === 1 && gt.scope) {
        const scopes = rowsForStream(jurisdiction, gt.stream).map((r) => r.scope);
        if (!scopes.includes(gt.scope)) {
          issues.push({
            item_id: item.id,
            jurisdiction,
            problem: `expected scope "${gt.scope}" not present among rows for stream "${gt.stream}"`,
            expected: gt,
            corpus_streams: known,
          });
        }
      }
    }
    if (gt.tier === 3) {
      if (gt.stream && known.includes(gt.stream)) {
        issues.push({
          item_id: item.id,
          jurisdiction,
          problem: `tier 3 label references existing stream "${gt.stream}" — Tier 3 must mean no corpus match`,
          expected: gt,
          corpus_streams: known,
        });
      }
    }
  }
  return issues;
}

export function allIntegrityIssues(benchFile: BenchFile): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  for (const item of benchFile.items) {
    issues.push(...checkBenchmarkIntegrity(item));
  }
  return issues;
}