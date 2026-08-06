export interface CheckIn {
  date: string;
  blockId: string;
  status: "done" | "partial" | "skipped";
  minutes?: number;
  note?: string;
  at: string;
}

/* ------------------------------------------------------------------
   The routine — pure logic, safe to import from client components.
   Blocks are declared; free time is *derived*. Anything not covered by
   a block on a given weekday is an unclaimed gap, and the dial draws it
   as one rather than pretending the day is fully accounted for.
   ------------------------------------------------------------------ */

export type Category =
  | "health"
  | "trading"
  | "work"
  | "learning"
  | "building"
  | "rest"
  | "free";

export interface Block {
  id: string;
  label: string;
  /** HH:MM, 24h */
  start: string;
  /** HH:MM, 24h. "24:00" is legal and means midnight. */
  end: string;
  category: Exclude<Category, "free">;
  /** 0 = Sunday */
  days: number[];
  note: string;
}

export interface Routine {
  timezone: string;
  label: string;
  blocks: Block[];
}

export interface Segment {
  id: string;
  label: string;
  category: Category;
  startMin: number;
  endMin: number;
  minutes: number;
  note: string;
  derived: boolean;
}

export const CATEGORY_COLOR: Record<Category, string> = {
  health: "#6ee7b7",
  trading: "#fbbf24",
  work: "#7dd3fc",
  learning: "#c4b5fd",
  building: "#d8ff3e",
  rest: "#4b4b55",
  free: "transparent",
};

export const CATEGORY_LABEL: Record<Category, string> = {
  health: "health",
  trading: "trading",
  work: "day job",
  learning: "learning",
  building: "building",
  rest: "rest",
  free: "unclaimed",
};

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function toClock(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function humanDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Expand a weekday into a full 0–1440 timeline. Blocks that cross
 * midnight are split; every remaining minute becomes a `free` segment.
 */
export function segmentsForDay(routine: Routine, weekday: number): Segment[] {
  const raw: Segment[] = [];

  for (const block of routine.blocks) {
    if (!block.days.includes(weekday)) continue;
    const start = toMinutes(block.start);
    const end = block.end === "24:00" ? 1440 : toMinutes(block.end);

    const push = (s: number, e: number) => {
      if (e <= s) return;
      raw.push({
        id: block.id,
        label: block.label,
        category: block.category,
        startMin: s,
        endMin: e,
        minutes: e - s,
        note: block.note,
        derived: false,
      });
    };

    if (end > start) push(start, end);
    else {
      // wraps midnight
      push(start, 1440);
      push(0, end);
    }
  }

  raw.sort((a, b) => a.startMin - b.startMin);

  // fill the gaps
  const filled: Segment[] = [];
  let cursor = 0;
  for (const segment of raw) {
    if (segment.startMin > cursor) {
      filled.push(freeSegment(cursor, segment.startMin));
    }
    filled.push(segment);
    cursor = Math.max(cursor, segment.endMin);
  }
  if (cursor < 1440) filled.push(freeSegment(cursor, 1440));

  return filled;
}

function freeSegment(start: number, end: number): Segment {
  return {
    id: `free-${start}`,
    label: "Unclaimed",
    category: "free",
    startMin: start,
    endMin: end,
    minutes: end - start,
    note: "No block covers this. It is either slack or it is drift — the dial does not guess which.",
    derived: true,
  };
}

/* ---------------- clock ---------------- */

export interface Clock {
  minutes: number;
  weekday: number;
  date: string;
  clock: string;
}

export function nowIn(timezone: string, at = new Date()): Clock {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false,
  }).formatToParts(at);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  const second = Number(get("second"));
  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return {
    minutes: hour * 60 + minute + second / 60,
    weekday: Math.max(0, weekdayNames.indexOf(get("weekday"))),
    date: `${get("year")}-${get("month")}-${get("day")}`,
    clock: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}

export function activeSegment(segments: Segment[], minutes: number): Segment | null {
  return (
    segments.find((s) => minutes >= s.startMin && minutes < s.endMin) ?? null
  );
}

export function nextSegment(segments: Segment[], minutes: number): Segment | null {
  const upcoming = segments.filter(
    (s) => s.startMin > minutes && s.category !== "free",
  );
  return upcoming[0] ?? segments.find((s) => s.category !== "free") ?? null;
}

/* ---------------- aggregates ---------------- */

export interface DayScore {
  date: string;
  weekday: number;
  done: number;
  partial: number;
  skipped: number;
  planned: number;
  pct: number;
  future: boolean;
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** Trackable blocks exclude sleep and derived free time. */
export function trackableBlocks(routine: Routine, weekday: number): Block[] {
  return routine.blocks.filter(
    (b) => b.days.includes(weekday) && b.category !== "rest",
  );
}

export function scoreDays(
  routine: Routine,
  checkIns: CheckIn[],
  today: string,
  days: number,
): DayScore[] {
  const byDate = new Map<string, CheckIn[]>();
  for (const c of checkIns) byDate.set(c.date, [...(byDate.get(c.date) ?? []), c]);

  const out: DayScore[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = shiftDate(today, -i);
    const weekday = weekdayOf(date);
    const planned = trackableBlocks(routine, weekday).length;
    const entries = byDate.get(date) ?? [];
    const done = entries.filter((e) => e.status === "done").length;
    const partial = entries.filter((e) => e.status === "partial").length;
    const skipped = entries.filter((e) => e.status === "skipped").length;
    out.push({
      date,
      weekday,
      done,
      partial,
      skipped,
      planned,
      pct: planned ? Math.min(100, ((done + partial * 0.5) / planned) * 100) : 0,
      future: false,
    });
  }
  return out;
}

export interface StreakInfo {
  current: number;
  longest: number;
  /** ratio of days in the window that cleared the bar */
  consistency: number;
  threshold: number;
}

/** A day "counts" when at least `threshold`% of its planned blocks landed. */
export function streaks(scores: DayScore[], threshold = 60): StreakInfo {
  let current = 0;
  let longest = 0;
  let run = 0;
  let cleared = 0;

  for (const day of scores) {
    if (day.planned === 0) continue;
    if (day.pct >= threshold) {
      run += 1;
      cleared += 1;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }

  // walk backwards from today for the live streak
  for (let i = scores.length - 1; i >= 0; i--) {
    const day = scores[i];
    if (day.planned === 0) continue;
    if (day.pct >= threshold) current += 1;
    else break;
  }

  const counted = scores.filter((s) => s.planned > 0).length;
  return {
    current,
    longest,
    consistency: counted ? cleared / counted : 0,
    threshold,
  };
}

export interface CategoryLoad {
  category: Category;
  minutes: number;
  share: number;
}

export function categoryLoad(segments: Segment[]): CategoryLoad[] {
  const totals = new Map<Category, number>();
  for (const s of segments)
    totals.set(s.category, (totals.get(s.category) ?? 0) + s.minutes);
  return [...totals.entries()]
    .map(([category, minutes]) => ({ category, minutes, share: minutes / 1440 }))
    .sort((a, b) => b.minutes - a.minutes);
}
