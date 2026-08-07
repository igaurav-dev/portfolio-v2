import { NextResponse } from "next/server";
import { migrateFilesToMongo } from "@/lib/store";
import { backend } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const { overwrite } = (await request.json().catch(() => ({}))) as {
    overwrite?: boolean;
  };

  if (backend() !== "mongodb") {
    return NextResponse.json(
      {
        error: "MONGODB_URI is not set — there is nothing to migrate into",
        hint: "Add MONGODB_URI to .env.local and restart, then run this again.",
      },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({ ok: true, ...(await migrateFilesToMongo(Boolean(overwrite))) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "migration failed" },
      { status: 500 },
    );
  }
}
