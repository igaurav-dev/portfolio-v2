import type { Metadata } from "next";
import { markRoute } from "@/lib/trace";
import { getGithubStats } from "@/lib/github";
import { getSkills } from "@/lib/content";
import { getRoutine, segmentsForDay, toClock } from "@/lib/routine";
import { Page, PageHead, Stat, SectionTitle, Tag } from "@/components/ui";
import { CommitClock, Verdict, duration } from "@/components/commit-clock";

export const metadata: Metadata = {
  title: "Receipts",
  description:
    "The one page on this site that isn't self-reported: real GitHub commit timestamps checked against the declared routine, and claimed skills checked against public code.",
  alternates: { canonical: "/proof" },
};

export default async function ProofPage() {
  markRoute("/proof");

  const [gh, skills, routine] = await Promise.all([
    getGithubStats(),
    getSkills(),
    getRoutine(),
  ]);

  // Compare against a weekday — the routine that actually has blocks in it.
  const segments = segmentsForDay(routine, 2);
  const codingSegments = segments.filter(
    (s) => s.category === "building" || s.category === "learning",
  );
  const codingHours = new Set(
    codingSegments.flatMap((s) => {
      const out: number[] = [];
      for (let h = Math.floor(s.startMin / 60); h < Math.ceil(s.endMin / 60); h++)
        out.push(h % 24);
      return out;
    }),
  );

  const totalCommits = gh.commits.length;
  const insideCoding = gh.hourHistogram.reduce(
    (n, count, hour) => n + (codingHours.has(hour) ? count : 0),
    0,
  );
  const insideShare = totalCommits ? insideCoding / totalCommits : 0;
  const duringDayJob = gh.hourHistogram
    .slice(13, 22)
    .reduce((a, b) => a + b, 0) / (totalCommits || 1);

  // claimed vs corroborated
  const claimed = new Set(
    Object.values(skills).flat().map((s) => s.toLowerCase()),
  );
  const evidenced = gh.languages.map((l) => l.language);
  const corroborated = evidenced.filter((l) =>
    [...claimed].some((c) => c.includes(l.toLowerCase()) || l.toLowerCase().includes(c)),
  );
  const unclaimed = evidenced.filter((l) => !corroborated.includes(l));

  if (!gh.ok) {
    return (
      <Page>
        <PageHead
          label="receipts"
          title="No receipts available."
          lede="This page reads live data from the GitHub API. It could not, so it is showing you nothing rather than something plausible."
        />
        <p className="mono border-l-2 py-2 pl-4" style={{ borderColor: "var(--dead)", color: "var(--dim)" }}>
          {gh.error} · set GITHUB_USERNAME (and optionally GITHUB_TOKEN) and reload
        </p>
      </Page>
    );
  }

  return (
    <Page>
      <PageHead
        label="receipts"
        title="The only page here I can't edit."
        lede="Everything else on this site is self-reported. Commit timestamps are not — they are written by a machine at the moment work happens, and they do not care what the résumé says. So this page checks two claims against them."
        aside={
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-1 lg:gap-4">
            <Stat value={String(gh.publicRepos)} label="public repos" tone="signal" />
            <Stat value={String(totalCommits)} label="commits sampled" />
            <Stat value={String(gh.totalStars)} label="stars" />
            <Stat value={duration(gh.quirks.sampleWindowDays)} label="sample window" />
          </div>
        }
      />

      {/* ---------------- claim 1 ---------------- */}
      <section className="border-b py-12" style={{ borderColor: "var(--line)" }}>
        <SectionTitle count={`${totalCommits} commits · ${routine.timezone}`}>
          claim 1 — the routine says code happens at midnight
        </SectionTitle>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
          <CommitClock
            hours={gh.hourHistogram}
            segments={segments}
            timezone={routine.timezone}
          />

          <div>
            <Verdict
              label="commits landing in a block meant for code"
              value={`${(insideShare * 100).toFixed(0)}%`}
              tone={insideShare > 0.5 ? "signal" : "dead"}
              detail={
                insideShare > 0.5
                  ? `The declared windows — ${codingSegments.map((s) => `${toClock(s.startMin)}–${toClock(s.endMin)}`).join(", ")} — hold the majority. The routine is describing something real.`
                  : `The declared windows are ${codingSegments.map((s) => `${toClock(s.startMin)}–${toClock(s.endMin)}`).join(", ")}. Most commits land outside them. Either the routine is aspirational, or the interesting work is happening somewhere the schedule doesn't admit to.`
              }
            />
            <Verdict
              label="busiest hour"
              value={`${String(gh.quirks.busiestHour).padStart(2, "0")}:00`}
              detail={`More commits land here than in any other hour. The routine assigns this slot to "${segments.find((s) => gh.quirks.busiestHour * 60 >= s.startMin && gh.quirks.busiestHour * 60 < s.endMin)?.label ?? "nothing"}".`}
            />
            <Verdict
              label="commits during the 13:00–22:00 day job"
              value={`${(duringDayJob * 100).toFixed(0)}%`}
              tone={duringDayJob > 0.35 ? "dead" : "ink"}
              detail="Public commits only. A high number here is not incriminating — it usually means open-source work in gaps, or a timezone-shifted client. It is shown because hiding it would defeat the point of the page."
            />
            <Verdict
              label="after midnight, before 05:00"
              value={`${(gh.quirks.nightOwlShare * 100).toFixed(0)}%`}
              tone={gh.quirks.nightOwlShare > 0.3 ? "dead" : "ink"}
              detail="The routine allocates 45 minutes at 00:00 to startup work and then goes to sleep at 00:45. This is how honest that turned out to be."
            />
          </div>
        </div>
      </section>

      {/* ---------------- claim 2 ---------------- */}
      <section className="border-b py-12" style={{ borderColor: "var(--line)" }}>
        <SectionTitle count={`${evidenced.length} languages in public code`}>
          claim 2 — the skills list
        </SectionTitle>

        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <p className="mono mb-3" style={{ color: "var(--signal)" }}>
              claimed and corroborated ({corroborated.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {corroborated.map((l) => (
                <Tag key={l} tone="signal">
                  {l}
                </Tag>
              ))}
              {corroborated.length === 0 && (
                <span className="mono" style={{ color: "var(--faint)" }}>
                  nothing overlaps
                </span>
              )}
            </div>

            {unclaimed.length > 0 && (
              <>
                <p className="mono mb-3 mt-7" style={{ color: "var(--faint)" }}>
                  in the code, not on the résumé ({unclaimed.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {unclaimed.map((l) => (
                    <Tag key={l}>{l}</Tag>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="prose-body text-[14.5px]">
            <p>
              <strong>Absence here is not evidence of absence.</strong> GitHub can only
              see public repositories. Four years of production work — the Azure
              platform at EXL, everything at Birchlogic, the RAG systems at VisionIAS —
              lives in private company repos and will never appear on this chart. Most
              senior engineers have a public profile that badly under-represents them.
            </p>
            <p>
              What this column <em>can</em> do is confirm the things it does see. A
              language in the corroborated list is one you can go and read code for
              right now. That is a weaker claim than the résumé makes, and a much
              easier one to check.
            </p>
          </div>
        </div>

        <dl className="mt-8 grid gap-x-8 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {gh.languages.slice(0, 9).map((l) => (
            <div
              key={l.language}
              className="flex items-baseline justify-between gap-3 border-b pb-1.5"
              style={{ borderColor: "var(--line)" }}
            >
              <dt className="text-[13.5px]" style={{ color: "var(--dim)" }}>
                {l.language}
              </dt>
              <dd className="num text-[12.5px]" style={{ color: "var(--faint)" }}>
                {l.repos} {l.repos === 1 ? "repo" : "repos"}
                {l.stars > 0 && ` · ${l.stars}★`}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ---------------- quirks ---------------- */}
      <section className="border-b py-12" style={{ borderColor: "var(--line)" }}>
        <SectionTitle>things the commit log knows about him</SectionTitle>
        <div className="grid gap-x-10 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          <Verdict
            label="longest silence"
            value={duration(gh.quirks.longestSilenceDays)}
            detail="The biggest gap between two consecutive public pushes in the sample."
          />
          <Verdict
            label="weekend share"
            value={`${(gh.quirks.weekendShare * 100).toFixed(0)}%`}
            detail="The routine only schedules sleep and dinner on Saturday and Sunday. This is what actually happens."
          />
          <Verdict
            label="median commit message"
            value={`${gh.quirks.medianMessageLength} chars`}
            detail={
              gh.quirks.medianMessageLength < 20
                ? "Terse. Future-you is going to have opinions about this."
                : "Long enough that someone could reconstruct the reasoning."
            }
          />
          <Verdict
            label="conventional commits"
            value={`${(gh.quirks.conventionalShare * 100).toFixed(0)}%`}
            detail="Share of messages matching feat/fix/chore/docs/refactor. Discipline, measured rather than claimed."
          />
          <Verdict
            label="fix : feat ratio"
            value={
              gh.quirks.fixToFeatRatio === null
                ? "n/a"
                : `${gh.quirks.fixToFeatRatio.toFixed(2)} : 1`
            }
            tone={
              gh.quirks.fixToFeatRatio !== null && gh.quirks.fixToFeatRatio > 1.5
                ? "dead"
                : "ink"
            }
            detail={
              gh.quirks.fixToFeatRatio === null
                ? "Not enough conventional commits in the sample to say."
                : gh.quirks.fixToFeatRatio > 1.5
                  ? "More fixing than shipping. Either the tests are thin or the features are ambitious."
                  : "More shipping than fixing, which is the direction you want it pointing."
            }
          />
          <Verdict
            label="quietest active hour"
            value={`${String(gh.quirks.quietestActiveHour).padStart(2, "0")}:00`}
            detail="Code has been written in this hour, but rarely. Everyone has one."
          />
        </div>

        {gh.quirks.topWords.length > 0 && (
          <div className="mt-8">
            <p className="mono mb-3" style={{ color: "var(--faint)" }}>
              words he reaches for most in commit messages
            </p>
            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
              {gh.quirks.topWords.map((w, i) => (
                <span
                  key={w.word}
                  className="num"
                  style={{
                    fontSize: `${Math.max(13, 26 - i * 2)}px`,
                    color: i < 2 ? "var(--signal)" : "var(--dim)",
                  }}
                  title={`${w.count} times`}
                >
                  {w.word}
                  <span className="mono ml-1" style={{ color: "var(--faint)", fontSize: 10 }}>
                    {w.count}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ---------------- repos ---------------- */}
      <section className="border-b py-12" style={{ borderColor: "var(--line)" }}>
        <SectionTitle count={`${gh.repos.length} public`}>
          most recently pushed
        </SectionTitle>
        <div className="space-y-px">
          {gh.repos.slice(0, 10).map((r) => (
            <a
              key={r.name}
              href={r.url}
              target="_blank"
              rel="noreferrer noopener"
              className="row grid gap-2 border-b py-3 pl-4 sm:grid-cols-[minmax(0,1fr)_auto]"
              style={{ borderColor: "var(--line)" }}
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-baseline gap-2 text-[14.5px] font-medium">
                  {r.name}
                  {r.fork && <Tag>fork</Tag>}
                  {r.archived && <Tag tone="dead">archived</Tag>}
                </p>
                {r.description && (
                  <p className="mt-1 max-w-[64ch] text-[13.5px]" style={{ color: "var(--dim)" }}>
                    {r.description}
                  </p>
                )}
              </div>
              <p className="mono self-center whitespace-nowrap" style={{ color: "var(--faint)" }}>
                {r.language ?? "—"} · {r.stars}★ · pushed {r.pushedAt.slice(0, 10)}
              </p>
            </a>
          ))}
        </div>
      </section>

      <section className="py-10">
        <p className="mono max-w-[76ch]" style={{ color: "var(--faint)" }}>
          live from the GitHub API as @{gh.login},{" "}
          {gh.authenticated ? "authenticated" : "anonymous — 60 requests/hour"}
          {gh.rateLimitRemaining !== null && ` · ${gh.rateLimitRemaining} requests left this hour`}{" "}
          · cached 15 minutes · fetched {gh.fetchedAt.slice(11, 19)} UTC. commit
          timestamps are sampled from public push events, which GitHub caps at roughly
          300 — this is a recent window, not a career.
        </p>
      </section>
    </Page>
  );
}
