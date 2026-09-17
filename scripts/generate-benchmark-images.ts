import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

interface BenchmarkImage {
  kind: string;
  file: string;
  provenance: string;
}

interface BenchItem {
  id: string;
  label: string;
  image: BenchmarkImage;
}

interface BenchFile {
  items: BenchItem[];
}

const BENCH = path.resolve("data/benchmark_set.json");
const OUT_DIR = path.resolve("data/benchmark_images");
const PUBLIC_DIR = path.resolve("public/benchmark_images");

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const SHAPES = ["circle", "rect", "poly", "can", "bag"];
const PALETTES = [
  ["#dbeafe", "#60a5fa"],
  ["#fef3c7", "#f59e0b"],
  ["#dcfce7", "#4ade80"],
  ["#fce7f3", "#f472b6"],
  ["#e5e7eb", "#9ca3af"],
  ["#fef2f2", "#f87171"],
];

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function svgFor(item: BenchItem): string {
  const seed = hashString(item.id + item.label);
  const shape = pick(SHAPES, seed);
  const pal = pick(PALETTES, seed >>> 3);
  const [bg, fg] = pal;
  const cx = 320;
  const cy = 240;

  let body = "";
  if (shape === "circle") {
    body = `<circle cx="${cx}" cy="${cy}" r="90" fill="${fg}" stroke="#334155" stroke-width="6"/>`;
  } else if (shape === "rect") {
    body = `<rect x="230" y="140" width="180" height="200" rx="14" fill="${fg}" stroke="#334155" stroke-width="6"/>`;
  } else if (shape === "poly") {
    body = `<polygon points="320,110 420,240 360,370 280,370 220,240" fill="${fg}" stroke="#334155" stroke-width="6"/>`;
  } else if (shape === "can") {
    body = `<rect x="270" y="130" width="100" height="220" rx="8" fill="${fg}" stroke="#334155" stroke-width="6"/><ellipse cx="320" cy="130" rx="50" ry="18" fill="#f1f5f9" stroke="#334155" stroke-width="6"/>`;
  } else {
    body = `<path d="M300,170 Q320,120 360,150 Q410,180 380,300 Q360,360 300,350 Q240,340 240,260 Q240,200 300,170 Z" fill="${fg}" stroke="#334155" stroke-width="6"/>`;
  }

  const tainted = (seed >> 8) % 3 === 0;
  let stain = "";
  if (tainted) {
    stain = `<g opacity="0.6"><ellipse cx="360" cy="280" rx="60" ry="34" fill="#92400e"/><circle cx="290" cy="300" r="26" fill="#b45309"/></g>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
  <rect width="640" height="480" fill="${bg}"/>
  <text x="24" y="40" font-family="monospace" font-size="18" fill="#1e293b">SYNTHETIC RENDER — ${item.id} — ${item.label}</text>
  ${body}
  ${stain}
  <text x="24" y="460" font-family="monospace" font-size="14" fill="#475569">Procedurally generated. Not a photograph. For benchmark provenance see data/benchmark_set.json.</text>
</svg>
`;
}

function main(): number {
  const bench = JSON.parse(readFileSync(BENCH, "utf8")) as BenchFile;
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(PUBLIC_DIR, { recursive: true });
  let count = 0;
  for (const item of bench.items) {
    const svg = svgFor(item);
    const target = path.resolve(item.image.file);
    writeFileSync(target, svg);
    writeFileSync(path.resolve("public/benchmark_images", `${item.id}.svg`), svg);
    count++;
  }
  console.log(`GEN-IMAGES wrote ${count} synthetic SVG renders to ${OUT_DIR} and public/benchmark_images`);
  console.log("GEN-IMAGES all images are procedurally generated; not photographs.");
  return 0;
}

process.exit(main());