/* ------------------------------------------------------------------
   Minimal admin session: an HMAC-signed cookie, no dependencies.
   Not a general auth system — one operator, one password.
   ------------------------------------------------------------------ */

export const SESSION_COOKIE = "gk_admin";
const TTL_MS = 12 * 60 * 60 * 1000;

function secret(): string {
  return (
    process.env.ADMIN_SECRET ??
    process.env.ADMIN_PASSWORD ??
    "insecure-development-secret-set-ADMIN_SECRET"
  );
}

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const b of view) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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
  return b64url(sig);
}

/** Constant-time string compare. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSession(): Promise<string> {
  const expires = Date.now() + TTL_MS;
  const payload = `admin.${expires}`;
  return `${payload}.${await sign(payload)}`;
}

export async function verifySession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [subject, expiresRaw, signature] = parts;
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  const expected = await sign(`${subject}.${expiresRaw}`);
  return safeEqual(signature, expected);
}

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function checkPassword(candidate: string): boolean {
  const actual = process.env.ADMIN_PASSWORD;
  if (!actual) return false;
  return safeEqual(candidate, actual);
}

export const SESSION_MAX_AGE = TTL_MS / 1000;
