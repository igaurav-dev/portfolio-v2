"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  activeSegment,
  categoryLoad,
  humanDuration,
  nextSegment,
  nowIn,
  segmentsForDay,
  toClock,
  type Routine,
  type Segment,
} from "@/lib/routine-core";

const R_OUT = 132;
const R_IN = 104;
const C = 160;
const SIZE = 320;

function polar(minutes: number, radius: number) {
  const angle = (minutes / 1440) * Math.PI * 2 - Math.PI / 2;
  return { x: C + Math.cos(angle) * radius, y: C + Math.sin(angle) * radius };
}

function arcPath(startMin: number, endMin: number, rOuter: number, rInner: number) {
  const a1 = polar(startMin, rOuter);
  const a2 = polar(endMin, rOuter);
  const b2 = polar(endMin, rInner);
  const b1 = polar(startMin, rInner);
  const large = endMin - startMin > 720 ? 1 : 0;
  return [
    `M ${a1.x} ${a1.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${a2.x} ${a2.y}`,
    `L ${b2.x} ${b2.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${b1.x} ${b1.y}`,
    "Z",
  ].join(" ");
}

export function DayDial({ routine }: { routine: Routine }) {
  const [now, setNow] = useState(() => nowIn(routine.timezone));
  const [hover, setHover] = useState<Segment | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const tick = () => setNow(nowIn(routine.timezone));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [routine.timezone]);

  const segments = useMemo(
    () => segmentsForDay(routine, now.weekday),
    [routine, now.weekday],
  );

  const current = activeSegment(segments, now.minutes);
  const upcoming = nextSegment(segments, now.minutes);
  const load = useMemo(() => categoryLoad(segments), [segments]);
  const shown = hover ?? current;

  const elapsed = current ? now.minutes - current.startMin : 0;
  const remaining = current ? current.endMin - now.minutes : 0;
  const progress = current ? elapsed / current.minutes : 0;
  const handle = polar(now.minutes, R_OUT + 12);
  const inner = polar(now.minutes, R_IN - 10);

  const freeMinutes = segments
    .filter((s) => s.category === "free")
    .reduce((n, s) => n + s.minutes, 0);

  return (
    <div className="grid gap-10 lg:grid-cols-[320px_1fr] lg:items-start">
      <div>
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="w-full max-w-[320px]"
          role="img"
          aria-label="24-hour routine dial"
        >
          {/* hour ticks */}
          {Array.from({ length: 24 }, (_, h) => {
            const major = h % 6 === 0;
            const a = polar(h * 60, R_OUT + (major ? 8 : 4));
            const b = polar(h * 60, R_OUT + 1);
            return (
              <line
                key={h}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={major ? "var(--line-bright)" : "var(--line)"}
                strokeWidth={major ? 1.4 : 0.8}
              />
            );
          })}
          {[0, 6, 12, 18].map((h) => {
            const p = polar(h * 60, R_OUT + 22);
            return (
              <text
                key={h}
                x={p.x}
                y={p.y + 3.5}
                textAnchor="middle"
                fontSize="9.5"
                fill="var(--faint)"
                letterSpacing="1"
              >
                {String(h).padStart(2, "0")}
              </text>
            );
          })}

          {/* segments */}
          {segments.map((s) => {
            const isFree = s.category === "free";
            const lit = shown?.id === s.id;
            return (
              <path
                key={`${s.id}-${s.startMin}`}
                d={arcPath(s.startMin, Math.min(s.endMin, 1439.9), R_OUT, R_IN)}
                fill={isFree ? "transparent" : CATEGORY_COLOR[s.category]}
                fillOpacity={isFree ? 0 : lit ? 1 : 0.62}
                stroke={isFree ? "var(--line-bright)" : "transparent"}
                strokeWidth={isFree ? 1 : 0}
                strokeDasharray={isFree ? "2 3" : undefined}
                style={{ cursor: "pointer", transition: "fill-opacity .2s" }}
                onMouseEnter={() => setHover(s)}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}

          {/* elapsed-today arc, faint, inside the ring */}
          {mounted && (
            <path
              d={arcPath(0, Math.max(now.minutes, 0.1), R_IN - 4, R_IN - 7)}
              fill="var(--signal)"
              fillOpacity={0.5}
            />
          )}

          {/* the hand */}
          {mounted && (
            <>
              <line
                x1={inner.x}
                y1={inner.y}
                x2={handle.x}
                y2={handle.y}
                stroke="var(--signal)"
                strokeWidth="1.6"
              />
              <circle cx={handle.x} cy={handle.y} r="4" fill="var(--signal)" />
              <circle
                cx={handle.x}
                cy={handle.y}
                r="8"
                fill="none"
                stroke="var(--signal)"
                strokeOpacity="0.35"
              />
            </>
          )}

          {/* centre readout */}
          <text
            x={C}
            y={C - 14}
            textAnchor="middle"
            fontSize="9.5"
            fill="var(--faint)"
            letterSpacing="1.6"
          >
            {mounted ? (current ? CATEGORY_LABEL[current.category].toUpperCase() : "—") : ""}
          </text>
          <text
            x={C}
            y={C + 12}
            textAnchor="middle"
            fontSize="25"
            fill="var(--ink)"
            letterSpacing="-1"
          >
            {mounted ? now.clock : "--:--"}
          </text>
          <text x={C} y={C + 30} textAnchor="middle" fontSize="9.5" fill="var(--faint)">
            {mounted && current ? `${humanDuration(Math.max(remaining, 0))} left` : ""}
          </text>
        </svg>
      </div>

      <div>
        {mounted && current ? (
          <>
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  background:
                    current.category === "free"
                      ? "var(--faint)"
                      : CATEGORY_COLOR[current.category],
                }}
              />
              <span className="mono" style={{ color: "var(--faint)" }}>
                right now · {toClock(current.startMin)}–{toClock(current.endMin)}
              </span>
              {current.derived && (
                <span
                  className="mono rounded border px-1.5 py-0.5"
                  style={{ borderColor: "var(--line-bright)", color: "var(--faint)" }}
                >
                  derived gap
                </span>
              )}
            </div>

            <h2 className="text-[clamp(1.6rem,4vw,2.3rem)] font-medium leading-tight tracking-[-0.03em]">
              {current.label}
            </h2>

            <div
              className="mt-4 h-1.5 w-full max-w-md overflow-hidden rounded-full"
              style={{ background: "var(--raised)" }}
            >
              <div
                className="h-full rounded-full transition-[width] duration-1000 ease-linear"
                style={{
                  width: `${Math.min(progress * 100, 100)}%`,
                  background:
                    current.category === "free"
                      ? "var(--faint)"
                      : CATEGORY_COLOR[current.category],
                }}
              />
            </div>
            <p className="mono mt-2" style={{ color: "var(--faint)" }}>
              {humanDuration(Math.max(elapsed, 0))} in · {humanDuration(Math.max(remaining, 0))} to go
              {upcoming && ` · next: ${upcoming.label} at ${toClock(upcoming.startMin)}`}
            </p>

            {current.note && (
              <p
                className="mt-5 max-w-[54ch] border-l-2 py-1 pl-4 text-[14.5px]"
                style={{
                  borderColor:
                    current.category === "free"
                      ? "var(--line-bright)"
                      : CATEGORY_COLOR[current.category],
                  color: "var(--dim)",
                }}
              >
                {current.note}
              </p>
            )}
          </>
        ) : (
          <p className="mono" style={{ color: "var(--faint)" }}>
            reading the clock…
          </p>
        )}

        <div className="mt-8 border-t pt-6" style={{ borderColor: "var(--line)" }}>
          <p className="mono mb-3" style={{ color: "var(--faint)" }}>
            how the 24 hours divide
          </p>
          <div className="flex h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--raised)" }}>
            {load.map((l) => (
              <div
                key={l.category}
                style={{
                  width: `${l.share * 100}%`,
                  background:
                    l.category === "free" ? "var(--line-bright)" : CATEGORY_COLOR[l.category],
                }}
                title={`${CATEGORY_LABEL[l.category]}: ${humanDuration(l.minutes)}`}
              />
            ))}
          </div>
          <dl className="mt-4 grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
            {load.map((l) => (
              <div
                key={l.category}
                className="flex items-baseline justify-between gap-3 border-b pb-1.5"
                style={{ borderColor: "var(--line)" }}
              >
                <dt className="mono flex items-center gap-2" style={{ color: "var(--dim)" }}>
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background:
                        l.category === "free" ? "var(--line-bright)" : CATEGORY_COLOR[l.category],
                    }}
                  />
                  {CATEGORY_LABEL[l.category]}
                </dt>
                <dd className="num text-[12.5px]">
                  {humanDuration(l.minutes)}
                  <span className="mono ml-2" style={{ color: "var(--faint)" }}>
                    {(l.share * 100).toFixed(0)}%
                  </span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mono mt-4 max-w-[62ch]" style={{ color: "var(--faint)" }}>
            {freeMinutes > 0
              ? `${humanDuration(freeMinutes)} of this weekday is unclaimed — no block covers it. Free time here is derived, not declared.`
              : "every minute of this weekday is claimed by a block."}
          </p>
        </div>
      </div>
    </div>
  );
}
