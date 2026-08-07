import { NextResponse } from "next/server";
import { ensureAdmin, requireAdmin, toPublic } from "@/lib/auth";
import { backend, pingDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Session check. The mobile app calls this on launch to decide whether
 *  its stored token is still good. */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok)
    return NextResponse.json({ error: auth.error }, { status: auth.status });

  return NextResponse.json(
    {
      ok: true,
      admin: toPublic(auth.admin),
      session: auth.kind,
      backend: backend(),
      store: await pingDb(),
      bootstrap: await ensureAdmin(),
      capabilities: {
        synthesis: Boolean(process.env.ANTHROPIC_API_KEY),
        github: Boolean(process.env.GITHUB_USERNAME),
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
