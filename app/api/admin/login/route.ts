import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  adminConfigured,
  authenticate,
  createSession,
  ensureAdmin,
  toPublic,
} from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface Attempt {
  count: number;
  until: number;
}
const attempts = new Map<string, Attempt>();
const MAX_ATTEMPTS = 8;
const LOCKOUT_MS = 10 * 60 * 1000;

function key(request: Request, email: string): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "local";
  return `${ip}:${email.toLowerCase()}`;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    /** mobile clients get a long-lived bearer token instead of a cookie */
    client?: "web" | "mobile";
  };

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const isMobile = body.client === "mobile";

  if (!email || !password) {
    return NextResponse.json(
      { error: "email and password are both required" },
      { status: 400 },
    );
  }

  const bucket = key(request, email);
  const now = Date.now();
  const record = attempts.get(bucket);
  if (record && record.until > now && record.count >= MAX_ATTEMPTS) {
    return NextResponse.json(
      {
        error: `too many attempts — try again in ${Math.ceil((record.until - now) / 60000)} minutes`,
      },
      { status: 429 },
    );
  }

  // Creates the first admin from the environment if none exists yet.
  const bootstrap = await ensureAdmin();

  const admin = await authenticate(email, password);
  if (!admin) {
    attempts.set(bucket, {
      count: (record && record.until > now ? record.count : 0) + 1,
      until: now + LOCKOUT_MS,
    });
    return NextResponse.json(
      {
        error: "incorrect email or password",
        hint:
          bootstrap.total === 0 && !adminConfigured()
            ? "no admin exists yet — set ADMIN_EMAIL and ADMIN_PASSWORD in .env.local and restart"
            : undefined,
      },
      { status: 401 },
    );
  }

  attempts.delete(bucket);

  const session = await createSession(admin.id, isMobile ? "mobile" : "web");
  const payload = {
    ok: true,
    admin: toPublic(admin),
    token: session.token,
    expiresAt: session.expiresAt,
  };

  // Mobile keeps the token itself; the browser gets an httpOnly cookie
  // so no script on the page can read it.
  if (isMobile) return NextResponse.json(payload);

  const response = NextResponse.json({ ...payload, token: undefined });
  response.cookies.set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
