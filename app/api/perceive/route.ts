import { NextResponse } from "next/server";
import { perceive } from "@/lib/perception";
import sharp from "sharp";

async function resolveImageData(
  body: { image_data?: string; image_path?: string }
): Promise<{ ref: string; mime: string } | { ref: string; error: string }> {
  if (body.image_data) {
    if (!body.image_data.startsWith("data:image/")) {
      return { ref: body.image_data, error: "image_data must be a data:image/* URI" };
    }
    return { ref: body.image_data, mime: body.image_data.slice(5, body.image_data.indexOf(";")) };
  }
  if (body.image_path) {
    const lc = body.image_path.toLowerCase();
    if (lc.endsWith(".svg") || lc.endsWith(".svgz")) {
      try {
        const png = await sharp(body.image_path, { density: 96 }).png().toBuffer();
        return {
          ref: `data:image/png;base64,${png.toString("base64")}`,
          mime: "image/png",
        };
      } catch (err) {
        return { ref: body.image_path, error: `svg rasterization failed: ${(err as Error).message}` };
      }
    }
    return { ref: body.image_path, mime: "image/jpeg" };
  }
  return { ref: "", error: "provide image_data or image_path" };
}

export async function POST(request: Request) {
  let body: { image_data?: string; image_path?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ output: null, error: "invalid JSON body" }, { status: 400 });
  }

  const resolved = await resolveImageData(body);
  if ("error" in resolved) {
    return NextResponse.json({ output: null, error: resolved.error }, { status: 400 });
  }

  const perception = await perceive(resolved.ref);
  return NextResponse.json(perception);
}