import { NextResponse } from "next/server";
import { perceive } from "@/lib/perception";

function resolveImageData(
  body: { image_data?: string }
): { ref: string; mime: string } | { ref: string; error: string } {
  if (!body.image_data) {
    return { ref: "", error: "provide image_data (data:image/* URI)" };
  }
  if (!body.image_data.startsWith("data:image/")) {
    return { ref: body.image_data, error: "image_data must be a data:image/* URI" };
  }
  const mime = body.image_data.slice(5, body.image_data.indexOf(";"));
  return { ref: body.image_data, mime };
}

export async function POST(request: Request) {
  let body: { image_data?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ output: null, error: "invalid JSON body" }, { status: 400 });
  }

  const resolved = resolveImageData(body);
  if ("error" in resolved) {
    return NextResponse.json({ output: null, error: resolved.error }, { status: 400 });
  }

  const perception = await perceive(resolved.ref);
  return NextResponse.json(perception);
}