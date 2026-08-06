import {
  CATEGORY_COLOR,
  humanDuration,
  toClock,
  type Segment,
} from "@/lib/routine-core";

/**
 * The one chart on this site that compares a claim against evidence:
 * declared routine blocks behind, real commit timestamps in front.
 */
export function CommitClock({
  hours,
  segments,
  timezone,
}: {
  hours: number[];
  segments: Segment[];
  timezone: string;
}) {
  const peak = Math.max(...hours, 1);
  const total = hours.reduce((a, b) => a + b, 0);

  // which routine block owns each hour, for the band behind the bars
  const ownerOf = (hour: number): Segment | undefined =>
    segments.find((s) => hour * 60 >= s.startMin && hour * 60 < s.endMin);

  return (
    <div>
      <div className="relative">
        {/* routine bands */}
        <div className="mb-1 flex h-3 w-full overflow-hidden rounded-[3px]">
          {Array.from({ length: 24 }, (_, h) => {
            const owner = ownerOf(h);
            const free = !owner || owner.category === "free";
            return (
              <div
                key={h}
                className="flex-1"
                style={{
                  background: free ? "transparent" : CATEGORY_COLOR[owner.category],
                  opacity: free ? 1 : 0.32,
                  backgroundImage: free
                    ? "repeating-linear-gradient(45deg, var(--line-bright) 0 1px, transparent 1px 5px)"
                    : undefined,
                  borderRight: "1px solid var(--bg)",
                }}
                title={
                  owner
                    ? `${toClock(h * 60)} — planned: ${owner.label}`
                    : `${toClock(h * 60)} — unclaimed`
                }
              />
            );
          })}
        </div>

        {/* actual commits */}
        <div className="flex h-40 items-end gap-[2px]">
          {hours.map((n, h) => {
            const owner = ownerOf(h);
            const codingBlock =
              owner &&
              (owner.category === "building" || owner.category === "learning");
            return (
              <div
                key={h}
                className="flex-1 rounded-t-[2px] transition-all"
                style={{
                  height: `${Math.max((n / peak) * 100, n > 0 ? 3 : 0.8)}%`,
                  background: n === 0
                    ? "var(--raised)"
                    : codingBlock
                      ? "var(--signal)"
                      : "var(--dead)",
                  opacity: n === 0 ? 0.5 : 1,
                }}
                title={`${toClock(h * 60)}–${toClock((h + 1) * 60)} · ${n} commits (${((n / (total || 1)) * 100).toFixed(1)}%) · planned: ${owner?.label ?? "unclaimed"}`}
              />
            );
          })}
        </div>
      </div>

      <div className="mono mt-1.5 flex justify-between" style={{ color: "var(--faint)" }}>
        {[0, 6, 12, 18, 23].map((h) => (
          <span key={h}>{String(h).padStart(2, "0")}</span>
        ))}
      </div>

      <div className="mono mt-4 flex flex-wrap gap-x-5 gap-y-2" style={{ color: "var(--faint)" }}>
        <span className="flex items-center gap-2">
          <span className="h-2 w-3 rounded-[2px]" style={{ background: "var(--signal)" }} />
          commits inside a block meant for code
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-3 rounded-[2px]" style={{ background: "var(--dead)" }} />
          commits outside one
        </span>
        <span className="flex items-center gap-2">
          <span
            className="h-2 w-3 rounded-[2px]"
            style={{ background: "var(--line-bright)", opacity: 0.5 }}
          />
          declared routine, {timezone}
        </span>
      </div>
    </div>
  );
}

export function Verdict({
  label,
  value,
  detail,
  tone = "ink",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "ink" | "signal" | "dead";
}) {
  const color =
    tone === "signal" ? "var(--signal)" : tone === "dead" ? "var(--dead)" : "var(--ink)";
  return (
    <div className="border-b py-4" style={{ borderColor: "var(--line)" }}>
      <p className="mono mb-1.5" style={{ color: "var(--faint)" }}>
        {label}
      </p>
      <p className="num text-[21px]" style={{ color }}>
        {value}
      </p>
      <p className="mt-1.5 max-w-[46ch] text-[13.5px]" style={{ color: "var(--dim)" }}>
        {detail}
      </p>
    </div>
  );
}

export function duration(days: number): string {
  if (days < 1) return humanDuration(days * 24 * 60);
  return `${days.toFixed(1)} days`;
}
