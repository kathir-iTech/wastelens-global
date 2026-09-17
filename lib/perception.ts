import fs from "node:fs";
import path from "node:path";
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

export interface PerceptionOutput {
  object_class: string;
  material_surface: string;
  contamination: boolean;
  hazard_flags: string[];
  confidence: number;
}

export interface PerceptionResult {
  output: PerceptionOutput;
  engine: "local-yolo12n" | "local-rf-detr" | "gemini-fallback";
  model_id: string;
  last_resolved: string | null;
}

export interface PerceptionFailure {
  output: null;
  error: string;
  model_id: string | null;
}

type PerceptionResponse = PerceptionResult | PerceptionFailure;

const GEMINI_API_ROOT = "https://generativelanguage.googleapis.com/v1beta";
const GENERATED_MODEL_FILE = path.resolve("data/generated/flash_vision_model.json");

export interface ResolvedModel {
  status: "ok" | "unreachable";
  chosen: string | null;
  candidates: string[];
  source_url: string;
  checked_at: string;
  reason?: string;
}

export function resolveFlashVisionModel(): ResolvedModel | null {
  if (!fs.existsSync(GENERATED_MODEL_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(GENERATED_MODEL_FILE, "utf8")) as ResolvedModel;
  } catch {
    return null;
  }
}

export function currentFlashVisionModel(): string | null {
  const resolved = resolveFlashVisionModel();
  if (resolved && resolved.status === "ok" && resolved.chosen) {
    return resolved.chosen;
  }
  return null;
}

function emptyOutput(): PerceptionOutput {
  return {
    object_class: "",
    material_surface: "",
    contamination: false,
    hazard_flags: [],
    confidence: 0,
  };
}

function parseStructuredFieldsFromText(text: string): PerceptionOutput {
  const out = emptyOutput();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed.object_class === "string") out.object_class = parsed.object_class;
      if (typeof parsed.material_surface === "string") out.material_surface = parsed.material_surface;
      if (typeof parsed.contamination === "boolean") out.contamination = parsed.contamination;
      if (Array.isArray(parsed.hazard_flags)) out.hazard_flags = parsed.hazard_flags.map(String);
      if (typeof parsed.confidence === "number") out.confidence = parsed.confidence;
      return out;
    } catch {
      // fall through to keyword extraction
    }
  }
  const objectMatch = text.match(/object_class["':\s]+([A-Za-z][A-Za-z -]*)/i);
  if (objectMatch) out.object_class = objectMatch[1].trim();
  const materialMatch = text.match(/material_surface["':\s]+([A-Za-z][A-Za-z -]*)/i);
  if (materialMatch) out.material_surface = materialMatch[1].trim();
  out.hazard_flags = text.match(/hazard_flag[s]?["':\s]+([^\]}\n]+)/i)
    ? text.split(/hazard_flag/i)[1].slice(0, 160).match(/[a-z][a-z -]*/gi) ?? []
    : [];
  const conf = text.match(/confidence["':\s]+(\d+(?:\.\d+)?)/i);
  if (conf) out.confidence = Number(conf[1]);
  return out;
}

async function encodeImageRef(imageRef: string): Promise<{ data: string; mime: string } | null> {
  if (/^data:image\//.test(imageRef)) {
    const mime = imageRef.slice(5, imageRef.indexOf(";"));
    return { data: imageRef, mime };
  }
  if (/^https?:\/\//.test(imageRef)) return null;
  if (fs.existsSync(imageRef)) {
    const ext = path.extname(imageRef).toLowerCase();
    if (ext === ".svg") {
      const buf = fs.readFileSync(imageRef);
      return { data: `data:image/svg+xml;base64,${buf.toString("base64")}`, mime: "image/svg+xml" };
    }
    const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".webp" ? "image/webp" : "image/png";
    const buf = fs.readFileSync(imageRef);
    return { data: `data:${mime};base64,${buf.toString("base64")}`, mime };
  }
  return null;
}

async function geminiFetch(
  url: string,
  init: RequestInit,
  attempts = 4
): Promise<Response> {
  let last: Response | null = null;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, init);
      last = res;
      if (attempt >= attempts || (res.status !== 429 && res.status < 500)) return res;
    } catch (err) {
      if (attempt >= attempts) {
        return new Response(`network error: ${String(err).slice(0, 200)}`, { status: 503 });
      }
    }
    await new Promise((r) => setTimeout(r, 3000 * attempt));
  }
}

async function perceiveViaGemini(
  imageRef: string,
  model: string
): Promise<PerceptionResult | PerceptionFailure> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      output: null,
      error: "GEMINI_API_KEY not set; fallback perception unavailable",
      model_id: model,
    };
  }
  const encoded = await encodeImageRef(imageRef);
  if (!encoded) {
    return {
      output: null,
      error: `image_ref not readable locally: ${imageRef}`,
      model_id: model,
    };
  }
  const prompt = [
    "Inspect this photograph of household waste. Answer only the visual question below.",
    "Do not comment on legality, fines, ordinances, or which bin to use. Do not answer those.",
    "Return JSON:",
    "{\"object_class\": \"item one would name it\", \"material_surface\": \"dominant material like glass/plastic/paper/metal/organic\", \"contamination\": true|false, \"hazard_flags\": [\"list\"], \"confidence\": 0..1}",
  ].join(" ");

  const res = await geminiFetch(
    `${GEMINI_API_ROOT}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { inline_data: { mime_type: encoded.mime, data: encoded.data.split(",")[1] } },
              { text: prompt },
            ],
          },
        ],
      }),
    }
  );

  if (!res.ok) {
    return {
      output: null,
      error: `Gemini ${model} returned ${res.status}: ${(await res.text()).slice(0, 300)}`,
      model_id: model,
    };
  }

  const body = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const output = parseStructuredFieldsFromText(text);
  if (!output.object_class) {
    return { output: null, error: "Gemini response had no parseable object_class", model_id: model };
  }
  return { output, engine: "gemini-fallback", model_id: model, last_resolved: null };
}

function localModelsPresent(): string[] {
  const dir = process.env.WASTELENS_MODELS_DIR || "models";
  const found: string[] = [];
  if (fs.existsSync(path.join(dir, "yolo12n.onnx"))) found.push("yolo12n");
  if (fs.existsSync(path.join(dir, "rf-detr-base.onnx"))) found.push("rf-detr-base");
  if (fs.existsSync(path.join(dir, "rf-detr-base.pt"))) found.push("rf-detr-base");
  if (fs.existsSync(path.join(dir, "yolo12n.pt"))) found.push("yolo12n");
  return found;
}

async function localDetect(imageRef: string): Promise<PerceptionResult | PerceptionFailure> {
  const present = localModelsPresent();
  const reason = present.length === 0
    ? "no local model weights found in ./models (expected yolo12n.onnx / rf-detr-base.onnx); local detection not run"
    : "local model runner not connected in this build (weights present but no inference backend)";
  return {
    output: null,
    error: reason,
    model_id: present.join("+") || null,
  };
}

export async function perceive(imageRef: string): Promise<PerceptionResponse> {
  const local = await localDetect(imageRef);
  if (local.output !== null) return local;

  const model = currentFlashVisionModel();
  if (model) {
    return perceiveViaGemini(imageRef, model);
  }

  const resolved = resolveFlashVisionModel();
  const cause =
    resolved === null
      ? "data/generated/flash_vision_model.json absent — run `npm run resolve-model` at build time"
      : resolved.status === "unreachable"
        ? `build-time model check could not reach ${resolved.source_url}`
        : `no flash vision model resolved (status=${resolved.status})`;
  return {
    output: null,
    error: `${cause}; and ${local.error}`,
    model_id: null,
  };
}

export let geminiQuotaBlocked = false;

export async function perceiveBinForJurisdiction(
  imageRef: string,
  jurisdiction: string,
  vocabulary: string[]
): Promise<{ bin: string; stream: string | null; model_id: string } | null> {
  const model = currentFlashVisionModel();
  if (!model || !process.env.GEMINI_API_KEY) return null;
  const encoded = await encodeImageRef(imageRef);
  if (!encoded) return null;
  const res = await geminiFetch(`${GEMINI_API_ROOT}/models/${model}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { inline_data: { mime_type: encoded.mime, data: encoded.data.split(",")[1] } },
            {
              text: `This is ${jurisdiction} household waste. Which single stream from this list does the item belong to? ${vocabulary.join(
                ", "
              )}. Answer with exactly one stream name from the list. No explanation.`,
            },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    geminiQuotaBlocked = res.status === 429 || res.status === 403;
    console.warn(`RAW-VLM ${model} -> ${res.status} ${(await res.text()).slice(0, 120)}`);
    return null;
  }
  const body = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const lower = text.toLowerCase();
  const match = vocabulary.find((v) => lower.includes(v.toLowerCase()));
  return { bin: text.split("\n")[0].trim(), stream: match ?? null, model_id: model };
}

export async function perceiveRawBinGeneric(imageRef: string): Promise<{ bin: string; model_id: string } | null> {
  const model = currentFlashVisionModel();
  if (!model || !process.env.GEMINI_API_KEY) return null;
  const encoded = await encodeImageRef(imageRef);
  if (!encoded) return null;
  const res = await geminiFetch(`${GEMINI_API_ROOT}/models/${model}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { inline_data: { mime_type: encoded.mime, data: encoded.data.split(",")[1] } },
            { text: "Which single bin/receptacle should this item be placed in? Name the stream in one short phrase. No explanation." },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    geminiQuotaBlocked = res.status === 429 || res.status === 403;
    console.warn(`RAW-VLM ${model} -> ${res.status} ${(await res.text()).slice(0, 120)}`);
    return null;
  }
  const body = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return { bin: text.split("\n")[0].trim(), model_id: model };
}