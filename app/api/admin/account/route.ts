import { NextResponse } from "next/server";
import { requireAdmin, updateCredentials, listAdmins, toPublic } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok)
    return NextResponse.json({ error: auth.error }, { status: auth.status });

  return NextResponse.json(
    {
      admin: toPublic(auth.admin),
      admins: (await listAdmins()).map(toPublic),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function PUT(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok)
    return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    name?: string;
    currentPassword?: string;
    newPassword?: string;
  };

  const result = await updateCredentials(auth.admin.id, body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({
    ok: true,
    admin: result.admin,
    note: body.newPassword
      ? "password changed — existing sessions stay valid until they expire"
      : undefined,
  });
}
