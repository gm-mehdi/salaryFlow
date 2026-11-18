import { createHmac, timingSafeEqual } from "node:crypto";
import { SESSION_COOKIE, SESSION_MAX_AGE_SEC } from "./session";

export { SESSION_COOKIE, createSessionToken, verifySessionToken } from "./session";

export function getAppSecret(): string {
  const secret = process.env.APP_SECRET;
  if (!secret) {
    throw new Error("APP_SECRET is missing.");
  }
  return secret;
}

export function passwordsMatch(provided: string, expected: string): boolean {
  const a = createHmac("sha256", "salaryflow").update(provided).digest();
  const b = createHmac("sha256", "salaryflow").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function sessionCookieOptions(token: string): {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  };
}
