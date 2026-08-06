import { NextResponse } from "next/server";
import { readCheckIns } from "@/lib/db";
import {
  activeSegment,
  getRoutine,
  humanDuration,
  nextSegment,
  nowIn,
  scoreDays,
  segmentsForDay,
  streaks,
  toClock,
} from "@/lib/routine";

export const dynamic = "force-dynamic";

function shift(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Public, read-only. Powers the terminal's `day` and `streak` commands. */
export async function GET() {
  const routine = await getRoutine();
  const now = nowIn(routine.timezone);
  const segments = segmentsForDay(routine, now.weekday);
  const current = activeSegment(segments, now.minutes);
  const upcoming = nextSegment(segments, now.minutes);

  const checkIns = await readCheckIns(shift(now.date, -34));
  const month = scoreDays(routine, checkIns, now.date, 30);
  const week = month.slice(-7);
  const avg = (rows: typeof month) => {
    const counted = rows.filter((r) => r.planned > 0);
    return counted.length ? counted.reduce((n, r) => n + r.pct, 0) / counted.length : 0;
  };

  return NextResponse.json(
    {
      timezone: routine.timezone,
      clock: now.clock,
      date: now.date,
      current: current && {
        label: current.label,
        category: current.category,
        start: toClock(current.startMin),
        end: toClock(current.endMin),
        remaining: humanDuration(Math.max(current.endMin - now.minutes, 0)),
        derived: current.derived,
      },
      next: upcoming && { label: upcoming.label, start: toClock(upcoming.startMin) },
      freeToday: humanDuration(
        segments.filter((s) => s.category === "free").reduce((n, s) => n + s.minutes, 0),
      ),
      streak: streaks(month),
      week: avg(week),
      month: avg(month),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
