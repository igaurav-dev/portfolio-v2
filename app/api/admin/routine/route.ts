import { NextResponse } from "next/server";
import type { Routine, Block } from "@/lib/routine-core";
import { segmentsForDay, toMinutes } from "@/lib/routine-core";
import { readSingleton, saveSingleton } from "@/lib/store";

export const dynamic = "force-dynamic";

const FALLBACK: Routine = { timezone: "Asia/Kolkata", label: "Routine", blocks: [] };
const CATEGORIES = ["health", "trading", "work", "learning", "building", "rest"];

export async function GET() {
  const routine = await readSingleton<Routine>("routine", FALLBACK);
  // Free time is derived, so the planner can preview it without saving.
  const preview = Object.fromEntries(
    [0, 1, 2, 3, 4, 5, 6].map((d) => [
      d,
      segmentsForDay(routine, d)
        .filter((s) => s.category === "free")
        .map((s) => ({ start: s.startMin, end: s.endMin, minutes: s.minutes })),
    ]),
  );
  return NextResponse.json({ routine, freeByDay: preview }, {
    headers: { "cache-control": "no-store" },
  });
}

function validate(blocks: unknown): { ok: true; blocks: Block[] } | { ok: false; error: string } {
  if (!Array.isArray(blocks)) return { ok: false, error: "blocks must be an array" };
  const seen = new Set<string>();

  for (const raw of blocks) {
    const b = raw as Partial<Block>;
    if (!b.id || typeof b.id !== "string")
      return { ok: false, error: "every block needs an id" };
    if (seen.has(b.id)) return { ok: false, error: `duplicate block id: ${b.id}` };
    seen.add(b.id);
    if (!b.label) return { ok: false, error: `${b.id}: label is required` };
    if (!/^\d{2}:\d{2}$/.test(b.start ?? ""))
      return { ok: false, error: `${b.id}: start must be HH:MM` };
    if (!/^\d{2}:\d{2}$/.test(b.end ?? ""))
      return { ok: false, error: `${b.id}: end must be HH:MM` };
    if (toMinutes(b.start!) === toMinutes(b.end!))
      return { ok: false, error: `${b.id}: start and end are identical` };
    if (!CATEGORIES.includes(b.category ?? ""))
      return { ok: false, error: `${b.id}: category must be one of ${CATEGORIES.join(", ")}` };
    if (!Array.isArray(b.days) || b.days.some((d) => d < 0 || d > 6))
      return { ok: false, error: `${b.id}: days must be numbers 0–6` };
  }

  // overlap check, per weekday
  for (let day = 0; day <= 6; day++) {
    const spans = (blocks as Block[])
      .filter((b) => b.days.includes(day))
      .flatMap((b) => {
        const s = toMinutes(b.start);
        const e = b.end === "24:00" ? 1440 : toMinutes(b.end);
        return e > s
          ? [{ id: b.id, s, e }]
          : [
              { id: b.id, s, e: 1440 },
              { id: b.id, s: 0, e },
            ];
      })
      .sort((a, b) => a.s - b.s);

    for (let i = 1; i < spans.length; i++) {
      if (spans[i].s < spans[i - 1].e) {
        return {
          ok: false,
          error: `"${spans[i - 1].id}" and "${spans[i].id}" overlap on day ${day}`,
        };
      }
    }
  }

  return { ok: true, blocks: blocks as Block[] };
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Partial<Routine>;
  const result = validate(body.blocks);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const current = await readSingleton<Routine>("routine", FALLBACK);
  const next: Routine = {
    timezone: body.timezone || current.timezone,
    label: body.label || current.label,
    blocks: result.blocks.sort((a, b) => toMinutes(a.start) - toMinutes(b.start)),
  };

  try {
    await saveSingleton("routine", next as unknown as Record<string, unknown>);
    return NextResponse.json({ ok: true, blocks: next.blocks.length });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "write failed",
        hint: "Without MONGODB_URI this writes to content/routine.json, which needs a writable filesystem.",
      },
      { status: 500 },
    );
  }
}
