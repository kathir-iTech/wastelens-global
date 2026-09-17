import { NextResponse } from "next/server";
import { adjudicate, AdjudicationInput } from "@/lib/matrix";

export async function POST(request: Request) {
  let body: AdjudicationInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!["india", "nyc", "england"].includes(body.jurisdiction)) {
    return NextResponse.json({ error: "unknown jurisdiction" }, { status: 400 });
  }
  const verdict = await adjudicate(body);
  return NextResponse.json({ verdict, used_network: false });
}