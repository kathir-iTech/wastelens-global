import { Jurisdiction, JURISDICTIONS, streamExists } from "./corpus";
import { PerceptionOutput } from "./perception";

type Family =
  | "bio"
  | "paper"
  | "plastic"
  | "glass"
  | "metal"
  | "sanitary"
  | "special-care"
  | "garden"
  | "hazardous"
  | "construction"
  | "residual";

const FAMILY_KEYWORDS: Array<{ family: Family; keywords: string[] }> = [
  {
    family: "bio",
    keywords: [
      "banana", "peel", "apple", "core", "coffee grounds", "bread", "mould", "mold",
      "food", "fruit", "vegetable", "meat", "dairy", "scrap", "leftover", "egg shell",
      "kitchen waste", "organic",
    ],
  },
  {
    family: "paper",
    keywords: [
      "paper", "cardboard", "carton", "magazine", "newspaper", "box", "napkin",
      "tissue", "envelope", "office paper", "pizza box", "coffee cup", "tetra pak",
      "milk carton",
    ],
  },
  {
    family: "plastic",
    keywords: ["plastic", "bottle", "container", "styrofoam", "eps", "clamshell", "takeout", "cup"],
  },
  {
    family: "glass",
    keywords: ["glass", "jar", "bottle", "mirror", "bulb", "cfl", "fluorescent", "florescent"],
  },
  {
    family: "metal",
    keywords: ["can", "metal", "aluminium", "aluminum", "tin", "foil"],
  },
  {
    family: "sanitary",
    keywords: ["diaper", "nappy", "sanitary pad", "tampon", "sanitary"],
  },
  {
    family: "special-care",
    keywords: ["paint", "bulb", "thermometer", "medicine", "mercury", "fluorescent", "florescent", "cfl"],
  },
  {
    family: "garden",
    keywords: ["grass", "leaf", "leaves", "pruning", "weed", "garden", "clipping", "plant"],
  },
  {
    family: "hazardous",
    keywords: ["battery", "electronic", "phone", "smartphone", "laptop", "e-waste", "charger", "computer", "corrosive"],
  },
  {
    family: "construction",
    keywords: ["concrete", "brick", "debris", "construction", "cement", "tile", "asphalt", "rubble"],
  },
  {
    family: "residual",
    keywords: ["diaper", "nappy", "trash", "garbage", "residual", "soiled", "excrement", "pet waste", "mixed waste"],
  },
];

const FAMILY_TO_STREAM: Record<Jurisdiction, Partial<Record<Family, string>>> = {
  india: {
    bio: "wet",
    paper: "dry",
    plastic: "dry",
    glass: "dry",
    metal: "dry",
    sanitary: "sanitary",
    "special-care": "special-care",
  },
  nyc: {
    bio: "food",
    paper: "paper-card",
    plastic: "metal-plastic-glass",
    glass: "metal-plastic-glass",
    metal: "metal-plastic-glass",
    residual: "residual",
  },
  england: {
    bio: "food",
    plastic: "metal-plastic-glass",
    glass: "metal-plastic-glass",
    metal: "metal-plastic-glass",
    garden: "garden",
    residual: "residual",
  },
};

export interface MappedStream {
  family: Family;
  stream: string | null;
  hits: number;
}

const SPECIAL_CARE_KEYS: string[] = ["paint", "bulb", "thermometer", "medicine", "mercury", "fluorescent", "cfl"];

export function candidateStreams(
  out: PerceptionOutput,
  jurisdiction: Jurisdiction
): MappedStream[] {
  const haystack = `${out.object_class} ${out.material_surface}`.toLowerCase();
  const scored: Array<MappedStream & { score: number }> = [];

  for (const { family, keywords } of FAMILY_KEYWORDS) {
    const hits = keywords.filter((k) => haystack.includes(k)).length;
    if (hits === 0) continue;
    const stream =
      FAMILY_TO_STREAM[jurisdiction][family] ?? (family as string);
    if (!stream) continue;
    scored.push({ family, stream, hits, score: hits });
  }

  for (const s of scored) {
    if (out.contamination) s.score -= 0.4;
    if (s.stream && streamExists(jurisdiction, s.stream)) s.score += 0.5;
  }

  const hasSpecialCareObject = SPECIAL_CARE_KEYS.some((k) => haystack.includes(k));
  if (out.hazard_flags.length > 0 && hasSpecialCareObject) {
    const sc = scored.find((s) => s.family === "special-care");
    if (sc) sc.score += 100;
  }
  const hazardObject = scored.find((s) => s.family === "hazardous");
  if (hazardObject) hazardObject.score += 100;

  const nycDryPaint =
    jurisdiction === "nyc" &&
    haystack.includes("paint") &&
    !out.hazard_flags.some((h) => /wet|water|liquid|seep|oil|chemical/.test(h.toLowerCase()));
  if (nycDryPaint) {
    // DSNY ("For empty, dry paint cans, set out with your recycling"): an
    // empty/dry paint can is a metal/plastic recyclable in NYC; only wet or
    // leftover paint is household hazardous waste.
    return scored.filter((s) => s.family !== "special-care").sort((a, b) => b.score - a.score);
  }

  return scored.sort((a, b) => b.score - a.score);
}

export function mapPerceptionToAttributes(
  out: PerceptionOutput,
  jurisdiction: Jurisdiction,
  scope: string
): Record<string, unknown> {
  const top = candidateStreams(out, jurisdiction)[0];
  return {
    object_class: out.object_class,
    material_surface: out.material_surface,
    contamination: out.contamination,
    hazard_flags: out.hazard_flags,
    stream: top?.stream ?? undefined,
    scope,
  };
}

export function mapperCoverage(out: PerceptionOutput): Record<Jurisdiction, string | null> {
  return Object.fromEntries(
    JURISDICTIONS.map((j) => [j, candidateStreams(out, j)[0]?.stream ?? null])
  ) as Record<Jurisdiction, string | null>;
}