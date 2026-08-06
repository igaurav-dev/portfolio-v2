import type { Metadata } from "next";
import { markRoute } from "@/lib/trace";
import { readCheckIns, pingDb } from "@/lib/db";
import {
  getRoutine,
  nowIn,
  scoreDays,
  segmentsForDay,
  streaks,
  trackableBlocks,
  humanDuration,
} from "@/lib/routine";
import { Page, PageHead, SectionTitle } from "@/components/ui";
import { DayDial } from "@/components/day-dial";
import { DayTimeline } from "@/components/day-timeline";
import { StreakBoard } from "@/components/activity-charts";

export const metadata: Metadata = {
  title: "The day",
  description:
    "A live 24-hour dial of the routine — gym, trading, day job, learning, building — with free time derived rather than declared, plus 7- and 30-day consistency.",
  alternates: { canonical: "/day" },
};

function shift(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function DayPage() {
  markRoute("/day");

  const routine = await getRoutine();
  const now = nowIn(routine.timezone);
  const [checkIns, db] = await Promise.all([
    readCheckIns(shift(now.date, -34)),
    pingDb(),
  ]);

  const month = scoreDays(routine, checkIns, now.date, 30);
  const week = month.slice(-7);
  const streak = streaks(month);
  const segments = segmentsForDay(routine, now.weekday);
  const tracked = trackableBlocks(routine, now.weekday);
  const freeMinutes = segments
    .filter((s) => s.category === "free")
    .reduce((n, s) => n + s.minutes, 0);

  return (
    <Page>
      <PageHead
        label="the day"
        title="The routine, running live."
        lede="A 24-hour dial on IST that moves while you watch it. Blocks are declared; free time is derived — anything no block covers shows up as an unclaimed gap, because a schedule that pretends every minute is accounted for is a schedule nobody keeps."
        aside={
          <div className="grid grid-cols-3 gap-6 lg:grid-cols-1 lg:gap-4">
            <div>
              <p className="num text-[22px]" style={{ color: "var(--signal)" }}>
                {tracked.length}
              </p>
              <p className="mono mt-1" style={{ color: "var(--faint)" }}>
                blocks today
              </p>
            </div>
            <div>
              <p className="num text-[22px]">{humanDuration(freeMinutes)}</p>
              <p className="mono mt-1" style={{ color: "var(--faint)" }}>
                unclaimed
              </p>
            </div>
            <div>
              <p className="num text-[22px]">{streak.current}</p>
              <p className="mono mt-1" style={{ color: "var(--faint)" }}>
                day streak
              </p>
            </div>
          </div>
        }
      />

      <section className="border-b py-12" style={{ borderColor: "var(--line)" }}>
        <DayDial routine={routine} />
      </section>

      <section className="border-b py-12" style={{ borderColor: "var(--line)" }}>
        <SectionTitle count={routine.label}>the whole day, flattened</SectionTitle>
        <DayTimeline routine={routine} />
      </section>

      <section className="border-b py-12" style={{ borderColor: "var(--line)" }}>
        <SectionTitle count={`${checkIns.length} check-ins recorded`}>
          consistency
        </SectionTitle>
        <StreakBoard
          week={week}
          month={month}
          streak={streak}
          totalTracked={checkIns.length}
        />
      </section>

      <section className="py-12">
        <div className="grid gap-x-12 gap-y-4 md:grid-cols-[10rem_1fr]">
          <h2 className="mono" style={{ color: "var(--faint)" }}>
            how this works
          </h2>
          <div className="prose-body">
            <p>
              The dial reads your clock against the routine in{" "}
              <code>content/routine.json</code>, resolved in {routine.timezone}. Blocks
              carry a start, an end and the weekdays they apply to; everything left
              over is computed as free. Sleep is a block like any other, which is why
              the ring closes.
            </p>
            <p>
              Consistency comes from check-ins stored in{" "}
              <strong>{db.backend === "mongodb" ? "MongoDB" : "a local JSON store"}</strong>{" "}
              — {db.detail}. A day counts toward the streak when at least{" "}
              {streak.threshold}% of its planned blocks were completed. Sleep is
              excluded from scoring; taking credit for that would be cheating.
            </p>
            <p>
              Nothing here is retroactive. If no check-ins exist the numbers sit at
              zero rather than inventing a plausible history.
            </p>
          </div>
        </div>
      </section>
    </Page>
  );
}
