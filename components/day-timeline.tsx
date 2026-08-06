"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CATEGORY_COLOR,
  humanDuration,
  nowIn,
  segmentsForDay,
  toClock,
  type Routine,
} from "@/lib/routine-core";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function DayTimeline({ routine }: { routine: Routine }) {
  const [now, setNow] = useState(() => nowIn(routine.timezone));
  const [weekday, setWeekday] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const tick = () => setNow(nowIn(routine.timezone));
    tick();
    const id = setInterval(tick, 20_000);
    return () => clearInterval(id);
  }, [routine.timezone]);

  const day = weekday ?? now.weekday;
  const segments = useMemo(() => segmentsForDay(routine, day), [routine, day]);
  const isToday = day === now.weekday;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        {DAYS.map((d, i) => (
          <button
            key={d}
            onClick={() => setWeekday(i)}
            className="mono rounded border px-2 py-1"
            style={{
              borderColor: i === day ? "var(--signal)" : "var(--line-bright)",
              color: i === day ? "var(--signal)" : "var(--dim)",
            }}
          >
            {d}
          </button>
        ))}
        {weekday !== null && weekday !== now.weekday && (
          <button
            onClick={() => setWeekday(null)}
            className="mono ml-2 rounded border px-2 py-1"
            style={{ borderColor: "var(--line)", color: "var(--faint)" }}
          >
            back to today
          </button>
        )}
      </div>

      <div
        className="relative overflow-hidden rounded"
        style={{ background: "var(--raised)" }}
      >
        <div className="flex h-10 w-full">
          {segments.map((s) => (
            <div
              key={`${s.id}-${s.startMin}`}
              className="group relative"
              style={{
                width: `${(s.minutes / 1440) * 100}%`,
                background:
                  s.category === "free" ? "transparent" : CATEGORY_COLOR[s.category],
                opacity: s.category === "free" ? 1 : 0.75,
                borderRight: "1px solid var(--bg)",
                backgroundImage:
                  s.category === "free"
                    ? "repeating-linear-gradient(45deg, var(--line-bright) 0 1px, transparent 1px 6px)"
                    : undefined,
              }}
              title={`${s.label} · ${toClock(s.startMin)}–${toClock(s.endMin)} · ${humanDuration(s.minutes)}`}
            />
          ))}
        </div>

        {mounted && isToday && (
          <div
            className="pointer-events-none absolute inset-y-0 w-[2px]"
            style={{ left: `${(now.minutes / 1440) * 100}%`, background: "var(--ink)" }}
          >
            <span
              className="absolute -top-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
              style={{ background: "var(--ink)" }}
            />
          </div>
        )}
      </div>

      <div className="mono mt-1.5 flex justify-between" style={{ color: "var(--faint)" }}>
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>24:00</span>
      </div>

      <div className="mt-6 space-y-px">
        {segments.map((s) => {
          const live =
            mounted && isToday && now.minutes >= s.startMin && now.minutes < s.endMin;
          const past = mounted && isToday && now.minutes >= s.endMin;
          return (
            <div
              key={`${s.id}-${s.startMin}-row`}
              className="grid grid-cols-[7.5rem_1fr_auto] items-baseline gap-3 border-b py-2"
              style={{
                borderColor: "var(--line)",
                opacity: past ? 0.42 : 1,
              }}
            >
              <span className="num text-[12.5px]" style={{ color: "var(--faint)" }}>
                {toClock(s.startMin)}–{toClock(s.endMin)}
              </span>
              <span className="flex items-center gap-2.5 text-[14px]">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{
                    background:
                      s.category === "free" ? "var(--line-bright)" : CATEGORY_COLOR[s.category],
                  }}
                />
                <span style={{ color: s.category === "free" ? "var(--faint)" : "var(--ink)" }}>
                  {s.label}
                </span>
                {live && (
                  <span className="mono flex items-center gap-1.5" style={{ color: "var(--signal)" }}>
                    <span className="pulse-dot" aria-hidden />
                    now
                  </span>
                )}
              </span>
              <span className="mono" style={{ color: "var(--faint)" }}>
                {humanDuration(s.minutes)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
