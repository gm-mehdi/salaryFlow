import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "salaryflow_session";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

function authSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET is missing or too short (min 16 chars).");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ v: 1 })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SEC}s`)
    .sign(authSecretKey());
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, authSecretKey());
    return true;
  } catch {
    return false;
  }
}
