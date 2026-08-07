/* ------------------------------------------------------------------
   ADMIN AUTH
   Email + password against records in the store, PBKDF2-hashed. One
   admin is bootstrapped from ADMIN_EMAIL / ADMIN_PASSWORD the first
   time the server starts against an empty admins collection, so a
   fresh deployment is never locked out and no password ever has to be
   hard-coded into a seed file.

   Sessions are HMAC-signed tokens that work two ways: an httpOnly
   cookie for the browser, an Authorization: Bearer header for the
   mobile app. Verification is pure crypto with no database lookup, so
   it can run in edge middleware.
   ------------------------------------------------------------------ */

import { backend, collection } from "./db";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  randomHex,
  safeEqual,
  toBase64Url,
  type SessionKind,
} from "./session";

export {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSession,
  verifySession,
  tokenFromRequest,
  safeEqual,
  type SessionClaims,
  type SessionKind,
} from "./session";

const PBKDF2_ITERATIONS = 210_000;

export interface AdminRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  salt: string;
  iterations: number;
  createdAt: string;
  lastLoginAt: string | null;
  source: "env-bootstrap" | "manual";
}

export interface PublicAdmin {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  lastLoginAt: string | null;
  source: string;
}

export function toPublic(admin: AdminRecord): PublicAdmin {
  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    createdAt: admin.createdAt,
    lastLoginAt: admin.lastLoginAt,
    source: admin.source,
  };
}

export async function hashPassword(
  password: string,
  salt = randomHex(16),
  iterations = PBKDF2_ITERATIONS,
): Promise<{ hash: string; salt: string; iterations: number }> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(salt),
      iterations,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return { hash: toBase64Url(bits), salt, iterations };
}

export async function verifyPassword(
  password: string,
  admin: AdminRecord,
): Promise<boolean> {
  const { hash } = await hashPassword(password, admin.salt, admin.iterations);
  return safeEqual(hash, admin.passwordHash);
}

/* ---------------- admin storage ---------------- */

const ADMIN_FILE = path.join(process.cwd(), "data", "admins.json");

async function readAdminsFile(): Promise<AdminRecord[]> {
  try {
    return JSON.parse(await readFile(ADMIN_FILE, "utf8")) as AdminRecord[];
  } catch {
    return [];
  }
}

async function writeAdminsFile(admins: AdminRecord[]): Promise<void> {
  await mkdir(path.dirname(ADMIN_FILE), { recursive: true });
  await writeFile(ADMIN_FILE, `${JSON.stringify(admins, null, 2)}\n`, "utf8");
}

export async function listAdmins(): Promise<AdminRecord[]> {
  if (backend() === "mongodb") {
    try {
      const col = await collection<AdminRecord & Record<string, unknown>>("admins");
      const rows = await col.find({}, { projection: { _id: 0 } }).toArray();
      return rows as unknown as AdminRecord[];
    } catch {
      return readAdminsFile();
    }
  }
  return readAdminsFile();
}

export async function findAdminByEmail(email: string): Promise<AdminRecord | null> {
  const normalised = email.trim().toLowerCase();
  const admins = await listAdmins();
  return admins.find((a) => a.email.toLowerCase() === normalised) ?? null;
}

export async function findAdminById(id: string): Promise<AdminRecord | null> {
  const admins = await listAdmins();
  return admins.find((a) => a.id === id) ?? null;
}

export async function saveAdmin(admin: AdminRecord): Promise<void> {
  if (backend() === "mongodb") {
    const col = await collection<AdminRecord & Record<string, unknown>>("admins");
    await col.updateOne(
      { id: admin.id },
      { $set: { ...admin } as Record<string, unknown> },
      { upsert: true },
    );
    return;
  }
  const admins = await readAdminsFile();
  const index = admins.findIndex((a) => a.id === admin.id);
  if (index >= 0) admins[index] = admin;
  else admins.push(admin);
  await writeAdminsFile(admins);
}

/* ---------------- bootstrap ---------------- */

export interface BootstrapResult {
  created: boolean;
  reason: string;
  email?: string;
  total: number;
}

interface BootstrapState {
  done: boolean;
  result: BootstrapResult | null;
}

function bootstrapState(): BootstrapState {
  const g = globalThis as unknown as { __adminBootstrap?: BootstrapState };
  if (!g.__adminBootstrap) g.__adminBootstrap = { done: false, result: null };
  return g.__adminBootstrap;
}

/**
 * Called at server startup (instrumentation.ts) and again lazily before
 * any login attempt, because instrumentation does not run in every
 * runtime. Creating an admin that already exists is a no-op, so running
 * it twice is harmless.
 */
export async function ensureAdmin(force = false): Promise<BootstrapResult> {
  const state = bootstrapState();
  if (state.done && state.result && !force) return state.result;

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  const finish = (result: BootstrapResult) => {
    state.done = true;
    state.result = result;
    return result;
  };

  let existing: AdminRecord[] = [];
  try {
    existing = await listAdmins();
  } catch (err) {
    return finish({
      created: false,
      reason: `could not read admins: ${err instanceof Error ? err.message : "unknown"}`,
      total: 0,
    });
  }

  if (existing.length > 0) {
    return finish({
      created: false,
      reason: "an admin already exists",
      email: existing[0].email,
      total: existing.length,
    });
  }

  if (!email || !password) {
    return finish({
      created: false,
      reason:
        "no admin exists and ADMIN_EMAIL / ADMIN_PASSWORD are not both set — the panel cannot be opened until they are",
      total: 0,
    });
  }

  const { hash, salt, iterations } = await hashPassword(password);
  const admin: AdminRecord = {
    id: randomHex(12),
    email,
    name: process.env.ADMIN_NAME?.trim() || email.split("@")[0],
    passwordHash: hash,
    salt,
    iterations,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    source: "env-bootstrap",
  };

  try {
    await saveAdmin(admin);
  } catch (err) {
    return finish({
      created: false,
      reason: `could not write the admin record: ${err instanceof Error ? err.message : "unknown"}`,
      total: 0,
    });
  }

  return finish({
    created: true,
    reason: "created the first admin from ADMIN_EMAIL / ADMIN_PASSWORD",
    email,
    total: 1,
  });
}

export async function authenticate(
  email: string,
  password: string,
): Promise<AdminRecord | null> {
  await ensureAdmin();

  const admin = await findAdminByEmail(email);
  if (!admin) {
    // Spend roughly the same time as a real verification so a missing
    // account is not distinguishable by timing.
    await hashPassword(password, "decoy-salt-value", PBKDF2_ITERATIONS);
    return null;
  }
  if (!(await verifyPassword(password, admin))) return null;

  admin.lastLoginAt = new Date().toISOString();
  await saveAdmin(admin).catch(() => {});
  return admin;
}

export async function updateCredentials(
  adminId: string,
  patch: { email?: string; name?: string; currentPassword?: string; newPassword?: string },
): Promise<{ ok: true; admin: PublicAdmin } | { ok: false; error: string }> {
  const admin = await findAdminById(adminId);
  if (!admin) return { ok: false, error: "admin not found" };

  if (patch.newPassword) {
    if (!patch.currentPassword)
      return { ok: false, error: "the current password is required to set a new one" };
    if (!(await verifyPassword(patch.currentPassword, admin)))
      return { ok: false, error: "current password is incorrect" };
    if (patch.newPassword.length < 10)
      return { ok: false, error: "use at least 10 characters" };

    const { hash, salt, iterations } = await hashPassword(patch.newPassword);
    admin.passwordHash = hash;
    admin.salt = salt;
    admin.iterations = iterations;
    admin.source = "manual";
  }

  if (patch.email) {
    const next = patch.email.trim().toLowerCase();
    const clash = await findAdminByEmail(next);
    if (clash && clash.id !== admin.id)
      return { ok: false, error: "another admin already uses that email" };
    admin.email = next;
  }

  if (patch.name) admin.name = patch.name.trim();

  await saveAdmin(admin);
  return { ok: true, admin: toPublic(admin) };
}

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD);
}


/* ------------------------------------------------------------------
   Route helper. Every admin route calls this rather than trusting the
   header the middleware forwards.
   ------------------------------------------------------------------ */

export async function requireAdmin(
  request: Request,
): Promise<
  | { ok: true; admin: AdminRecord; kind: SessionKind }
  | { ok: false; status: number; error: string }
> {
  const { verifySession, tokenFromRequest } = await import("./session");
  const claims = await verifySession(tokenFromRequest(request));
  if (!claims) return { ok: false, status: 401, error: "unauthorised" };

  const admin = await findAdminById(claims.adminId);
  if (!admin)
    return { ok: false, status: 401, error: "this account no longer exists" };

  return { ok: true, admin, kind: claims.kind };
}
