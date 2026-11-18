import { NextResponse } from "next/server";
import { dispatchAction } from "@/server/src/dispatch";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await dispatchAction("POST", raw);
  return NextResponse.json(result.body, { status: result.status });
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
