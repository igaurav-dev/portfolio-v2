"use client";

import { useState } from "react";

/** Nanoseconds. Jeff Dean's table, updated to roughly-2026 hardware. */
const ENTRIES = [
  { label: "L1 cache reference", ns: 1 },
  { label: "Branch mispredict", ns: 3 },
  { label: "L2 cache reference", ns: 4 },
  { label: "Mutex lock / unlock", ns: 17 },
  { label: "Main memory reference", ns: 80 },
  { label: "Compress 1KB (zstd)", ns: 1_500 },
  { label: "Read 1MB sequentially from memory", ns: 20_000 },
  { label: "SSD random read", ns: 50_000 },
  { label: "Round trip within the same datacenter", ns: 300_000 },
  { label: "Read 1MB sequentially from SSD", ns: 500_000 },
  { label: "TLS handshake", ns: 3_000_000 },
  { label: "Disk seek (spinning rust)", ns: 8_000_000 },
  { label: "Bengaluru → Virginia round trip", ns: 210_000_000 },
];

function human(ns: number): string {
  if (ns < 1_000) return `${ns} ns`;
  if (ns < 1_000_000) return `${(ns / 1_000).toFixed(ns < 10_000 ? 1 : 0)} µs`;
  return `${(ns / 1_000_000).toFixed(ns < 10_000_000 ? 1 : 0)} ms`;
}

/** If an L1 reference took one second, how long would this take? */
function scaled(ns: number): string {
  const s = ns / ENTRIES[0].ns;
  if (s < 60) return `${s.toFixed(0)} seconds`;
  if (s < 3600) return `${(s / 60).toFixed(1)} minutes`;
  if (s < 86400) return `${(s / 3600).toFixed(1)} hours`;
  if (s < 86400 * 365) return `${(s / 86400).toFixed(1)} days`;
  return `${(s / (86400 * 365)).toFixed(1)} years`;
}

export function LatencyScale() {
  const [log, setLog] = useState(true);
  const max = ENTRIES[ENTRIES.length - 1].ns;

  const width = (ns: number) =>
    log
      ? (Math.log10(ns) / Math.log10(max)) * 100
      : Math.max((ns / max) * 100, 0.06);

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        {[
          { id: true, label: "log scale" },
          { id: false, label: "linear (honest)" },
        ].map((opt) => (
          <button
            key={String(opt.id)}
            onClick={() => setLog(opt.id)}
            className="mono rounded border px-2.5 py-1"
            style={{
              borderColor: log === opt.id ? "var(--signal)" : "var(--line-bright)",
              color: log === opt.id ? "var(--signal)" : "var(--dim)",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="space-y-2.5">
        {ENTRIES.map((e) => (
          <div key={e.label} className="grid grid-cols-[1fr] gap-1 sm:grid-cols-[minmax(0,17rem)_1fr_5.5rem] sm:items-center sm:gap-4">
            <span className="text-[13.5px]" style={{ color: "var(--dim)" }}>{e.label}</span>
            <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--raised)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${width(e.ns)}%`,
                  background: e.ns > 1_000_000 ? "var(--dead)" : "var(--signal)",
                }}
              />
            </div>
            <span className="num text-[12.5px] sm:text-right" style={{ color: "var(--ink)" }}>{human(e.ns)}</span>
          </div>
        ))}
      </div>

      <p className="prose-body mt-7 text-[14.5px]">
        {log
          ? "Log scale is how these tables are always drawn, and it is why the numbers never land. Switch to linear."
          : "This is the same data, drawn at true relative size. Twelve of the thirteen bars have vanished. A cross-continent round trip is not 'slower' than a memory reference — it is two and a half million times slower, and no amount of application-level cleverness closes that."}
      </p>

      <div className="mt-6 border-t pt-5" style={{ borderColor: "var(--line)" }}>
        <p className="mono mb-3" style={{ color: "var(--faint)" }}>
          if an L1 reference took one second
        </p>
        <dl className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
          {ENTRIES.filter((_, i) => [0, 4, 7, 8, 11, 12].includes(i)).map((e) => (
            <div key={e.label} className="flex items-baseline justify-between gap-4 border-b pb-1.5" style={{ borderColor: "var(--line)" }}>
              <dt className="truncate text-[13px]" style={{ color: "var(--dim)" }}>{e.label}</dt>
              <dd className="num shrink-0 text-[13px]" style={{ color: "var(--signal)" }}>{scaled(e.ns)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
