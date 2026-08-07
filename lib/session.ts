/* ------------------------------------------------------------------
   SESSION CRYPTO
   Pure Web Crypto, no database and no Node built-ins, so this can be
   imported from edge middleware. Anything that touches admin records
   lives in lib/auth.ts instead.
   ------------------------------------------------------------------ */

export const SESSION_COOKIE = "gk_admin";

const TTL_MS = Number(process.env.ADMIN_SESSION_TTL_MS ?? 12 * 60 * 60 * 1000);
const MOBILE_TTL_MS = Number(process.env.ADMIN_MOBILE_TTL_MS ?? 30 * 24 * 60 * 60 * 1000);

export const SESSION_MAX_AGE = TTL_MS / 1000;

function secret(): string {
  const value = process.env.ADMIN_SECRET;
  if (!value || value.length < 16) {
    // Deliberately loud but non-fatal: the site still runs, the admin
    // just is not safe to expose until this is set properly.
    return "insecure-development-secret-set-ADMIN_SECRET-to-something-long";
  }
  return value;
}

export function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const b of view) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomHex(bytes = 16): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time comparison. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toBase64Url(sig);
}

export type SessionKind = "web" | "mobile";

export async function createSession(
  adminId: string,
  kind: SessionKind = "web",
): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = Date.now() + (kind === "mobile" ? MOBILE_TTL_MS : TTL_MS);
  const payload = `${kind}.${adminId}.${expiresAt}`;
  return { token: `${payload}.${await sign(payload)}`, expiresAt };
}

export interface SessionClaims {
  kind: SessionKind;
  adminId: string;
  expiresAt: number;
}

/** Pure crypto — safe to call from edge middleware. */
export async function verifySession(
  token: string | undefined | null,
): Promise<SessionClaims | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;

  const [kind, adminId, expiresRaw, signature] = parts;
  if (kind !== "web" && kind !== "mobile") return null;

  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;

  const expected = await sign(`${kind}.${adminId}.${expiresRaw}`);
  if (!safeEqual(signature, expected)) return null;

  return { kind, adminId, expiresAt };
}

/** Pulls a session from either the cookie or an Authorization header. */
export function tokenFromRequest(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();

  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return rest.join("=");
  }
  return null;
}
