import type { Metadata } from "next";
import { getProfile, getTimeline } from "@/lib/content";
import { markRoute } from "@/lib/trace";
import { Page, PageHead, ArrowLink } from "@/components/ui";

export const metadata: Metadata = { title: "About" };

export default async function AboutPage() {
  markRoute("/about");
  const [profile, timeline] = await Promise.all([getProfile(), getTimeline()]);

  return (
    <Page>
      <PageHead label="about" title="Who is writing this." lede={profile.statement} />

      <section className="grid gap-x-12 gap-y-4 border-b py-10 md:grid-cols-[10rem_1fr]" style={{ borderColor: "var(--line)" }}>
        <h2 className="mono" style={{ color: "var(--faint)" }}>
          how I work
        </h2>
        <ol className="max-w-[64ch] space-y-4">
          {profile.principles.map((p, i) => (
            <li key={i} className="grid grid-cols-[2rem_1fr] gap-2">
              <span className="num pt-0.5 text-[12px]" style={{ color: "var(--signal)" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-[15px]" style={{ color: "var(--dim)" }}>
                {p}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-x-12 gap-y-4 border-b py-10 md:grid-cols-[10rem_1fr]" style={{ borderColor: "var(--line)" }}>
        <h2 className="mono" style={{ color: "var(--faint)" }}>
          where
        </h2>
        <div className="max-w-[64ch]">
          {timeline.map((r) => (
            <div key={r.org} className="border-b py-5 last:border-b-0" style={{ borderColor: "var(--line)" }}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <p className="text-[15px] font-medium">
                  {r.role} <span style={{ color: "var(--faint)" }}>·</span> {r.org}
                </p>
                <p className="mono" style={{ color: "var(--faint)" }}>
                  {r.period} · {r.location}
                </p>
              </div>
              <p className="mt-1.5 text-[14px]" style={{ color: "var(--dim)" }}>
                {r.note}
              </p>
              <ul className="mt-2 space-y-1">
                {r.highlights.map((h, i) => (
                  <li key={i} className="text-[13.5px]" style={{ color: "var(--faint)" }}>
                    — {h}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-x-12 gap-y-4 py-10 md:grid-cols-[10rem_1fr]">
        <h2 className="mono" style={{ color: "var(--faint)" }}>
          contact
        </h2>
        <div className="prose-body">
          <p>
            {profile.availability}. The fastest route is{" "}
            <a href={`mailto:${profile.email}`}>{profile.email}</a> — I read everything
            and reply to most of it.
          </p>
          <div className="mt-5 flex flex-wrap gap-x-7 gap-y-3">
            <ArrowLink href="/resume">Résumé</ArrowLink>
            <ArrowLink href="/ask">Ask the corpus instead</ArrowLink>
          </div>
        </div>
      </section>
    </Page>
  );
}
