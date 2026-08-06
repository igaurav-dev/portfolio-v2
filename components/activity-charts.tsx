import {
  CATEGORY_COLOR,
  humanDuration,
  type DayScore,
  type StreakInfo,
} from "@/lib/routine-core";

const DAY_INITIAL = ["S", "M", "T", "W", "T", "F", "S"];

function tone(pct: number, planned: number): string {
  if (planned === 0) return "var(--raised)";
  if (pct === 0) return "var(--raised)";
  if (pct < 40) return "color-mix(in srgb, var(--dead) 55%, var(--raised))";
  if (pct < 70) return "color-mix(in srgb, var(--signal) 35%, var(--raised))";
  if (pct < 90) return "color-mix(in srgb, var(--signal) 65%, var(--raised))";
  return "var(--signal)";
}

export function StreakBoard({
  week,
  month,
  streak,
  totalTracked,
}: {
  week: DayScore[];
  month: DayScore[];
  streak: StreakInfo;
  totalTracked: number;
}) {
  const weekAvg = week.length
    ? week.reduce((n, d) => n + d.pct, 0) / week.filter((d) => d.planned).length || 0
    : 0;
  const monthAvg = month.length
    ? month.reduce((n, d) => n + d.pct, 0) / month.filter((d) => d.planned).length || 0
    : 0;

  const empty = totalTracked === 0;

  return (
    <div>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <div>
          <p className="num text-[26px]" style={{ color: streak.current > 0 ? "var(--signal)" : "var(--ink)" }}>
            {streak.current}
          </p>
          <p className="mono mt-1" style={{ color: "var(--faint)" }}>
            day streak
          </p>
        </div>
        <div>
          <p className="num text-[26px]">{streak.longest}</p>
          <p className="mono mt-1" style={{ color: "var(--faint)" }}>
            longest
          </p>
        </div>
        <div>
          <p className="num text-[26px]">{weekAvg.toFixed(0)}%</p>
          <p className="mono mt-1" style={{ color: "var(--faint)" }}>
            last 7 days
          </p>
        </div>
        <div>
          <p className="num text-[26px]">{monthAvg.toFixed(0)}%</p>
          <p className="mono mt-1" style={{ color: "var(--faint)" }}>
            last 30 days
          </p>
        </div>
      </div>

      {empty && (
        <p className="mono mt-6 border-l-2 py-1 pl-4" style={{ borderColor: "var(--line-bright)", color: "var(--faint)" }}>
          no check-ins recorded yet — mark blocks done in the admin planner and these
          fill in. the numbers above stay at zero until they are real.
        </p>
      )}

      <div className="mt-9 grid gap-10 lg:grid-cols-2">
        <div>
          <p className="mono mb-4" style={{ color: "var(--faint)" }}>
            last 7 days
          </p>
          <div className="flex h-28 items-end gap-2">
            {week.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className="w-full rounded-t-[2px]"
                  style={{
                    height: `${Math.max(d.pct, 2)}%`,
                    background: tone(d.pct, d.planned),
                    minHeight: 3,
                  }}
                  title={`${d.date}: ${d.done}/${d.planned} blocks (${d.pct.toFixed(0)}%)`}
                />
                <span className="mono" style={{ color: "var(--faint)" }}>
                  {DAY_INITIAL[d.weekday]}
                </span>
              </div>
            ))}
          </div>
          <p className="mono mt-3" style={{ color: "var(--faint)" }}>
            bar height = share of planned blocks completed
          </p>
        </div>

        <div>
          <p className="mono mb-4" style={{ color: "var(--faint)" }}>
            last 30 days
          </p>
          <div className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-1.5">
            {month.map((d) => (
              <div
                key={d.date}
                className="aspect-square rounded-[2px]"
                style={{ background: tone(d.pct, d.planned) }}
                title={`${d.date}: ${d.done}/${d.planned} blocks (${d.pct.toFixed(0)}%)`}
              />
            ))}
          </div>
          <div className="mono mt-3 flex items-center gap-2" style={{ color: "var(--faint)" }}>
            <span>less</span>
            {[0, 45, 75, 95].map((p) => (
              <span
                key={p}
                className="h-2.5 w-2.5 rounded-[2px]"
                style={{ background: tone(p, 1) }}
              />
            ))}
            <span>more</span>
            <span className="ml-auto">
              {streak.consistency > 0
                ? `${(streak.consistency * 100).toFixed(0)}% of days cleared ${streak.threshold}%`
                : `bar is ${streak.threshold}% of planned blocks`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CategoryLegend({
  items,
}: {
  items: { category: string; minutes: number }[];
}) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2">
      {items.map((i) => (
        <span key={i.category} className="mono flex items-center gap-2" style={{ color: "var(--dim)" }}>
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background:
                CATEGORY_COLOR[i.category as keyof typeof CATEGORY_COLOR] ?? "var(--faint)",
            }}
          />
          {i.category} {humanDuration(i.minutes)}
        </span>
      ))}
    </div>
  );
}
