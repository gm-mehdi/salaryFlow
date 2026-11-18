import { NextResponse } from "next/server";
import {
  createSessionToken,
  getAppSecret,
  passwordsMatch,
  sessionCookieOptions,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let password = "";
  try {
    const body = (await req.json()) as { password?: string };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let expected: string;
  try {
    expected = getAppSecret();
  } catch {
    return NextResponse.json(
      { error: "Server is missing APP_SECRET." },
      { status: 500 },
    );
  }

  if (!password || !passwordsMatch(password, expected)) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }

  const token = await createSessionToken();
  const cookie = sessionCookieOptions(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookie);
  return res;
}
