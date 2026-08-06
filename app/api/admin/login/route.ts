import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  adminConfigured,
  checkPassword,
  createSession,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

const attempts = new Map<string, { count: number; until: number }>();

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const now = Date.now();
  const record = attempts.get(ip);
  if (record && record.until > now && record.count >= 6) {
    return NextResponse.json(
      { error: "too many attempts — wait a few minutes" },
      { status: 429 },
    );
  }

  if (!adminConfigured()) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD is not set on the server" },
      { status: 503 },
    );
  }

  const { password } = (await request.json().catch(() => ({}))) as {
    password?: string;
  };

  if (typeof password !== "string" || !checkPassword(password)) {
    attempts.set(ip, {
      count: (record && record.until > now ? record.count : 0) + 1,
      until: now + 10 * 60 * 1000,
    });
    // Constant-ish response time regardless of outcome.
    await new Promise((r) => setTimeout(r, 350));
    return NextResponse.json({ error: "incorrect password" }, { status: 401 });
  }

  attempts.delete(ip);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await createSession(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
