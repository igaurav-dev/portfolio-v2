import { NextResponse } from "next/server";
import { deleteCheckIn, readCheckIns, writeCheckIn, backend, pingDb } from "@/lib/db";
import { getRoutine, nowIn, trackableBlocks } from "@/lib/routine";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const routine = await getRoutine();
  const now = nowIn(routine.timezone);
  const date = new URL(request.url).searchParams.get("date") ?? now.date;

  const [entries, health] = await Promise.all([readCheckIns(date), pingDb()]);

  return NextResponse.json(
    {
      date,
      backend: backend(),
      health,
      blocks: trackableBlocks(routine, now.weekday).map((b) => ({
        id: b.id,
        label: b.label,
        start: b.start,
        end: b.end,
        category: b.category,
      })),
      entries: entries.filter((e) => e.date === date),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    date?: string;
    blockId?: string;
    status?: "done" | "partial" | "skipped";
    note?: string;
  };

  if (!body.date || !body.blockId || !body.status) {
    return NextResponse.json(
      { error: "date, blockId and status are all required" },
      { status: 400 },
    );
  }
  if (!["done", "partial", "skipped"].includes(body.status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  try {
    await writeCheckIn({
      date: body.date,
      blockId: body.blockId,
      status: body.status,
      note: body.note,
      at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, backend: backend() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "write failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const blockId = url.searchParams.get("blockId");
  if (!date || !blockId)
    return NextResponse.json({ error: "date and blockId required" }, { status: 400 });

  await deleteCheckIn(date, blockId);
  return NextResponse.json({ ok: true });
}
