import type { Metadata } from "next";
import { getProfile, getProjects, getTimeline } from "@/lib/content";
import { markRoute } from "@/lib/trace";
import { Page } from "@/components/ui";

export const metadata: Metadata = { title: "Résumé" };

export default async function ResumePage() {
  markRoute("/resume");
  const [profile, timeline, projects] = await Promise.all([
    getProfile(),
    getTimeline(),
    getProjects(),
  ]);

  const skills = [...new Set(projects.flatMap((p) => p.stack))];

  return (
    <Page>
      <div className="mx-auto max-w-[68ch] py-14">
        <header className="border-b pb-6" style={{ borderColor: "var(--line)" }}>
          <h1 className="text-[28px] font-medium tracking-tight">{profile.name}</h1>
          <p className="mt-1 text-[15px]" style={{ color: "var(--dim)" }}>
            {profile.role} · {profile.location}
          </p>
          <p className="mono mt-3" style={{ color: "var(--faint)" }}>
            {profile.email} · {profile.phone} · {profile.website}
          </p>
        </header>

        <section className="border-b py-6" style={{ borderColor: "var(--line)" }}>
          <p className="text-[14.5px]" style={{ color: "var(--dim)" }}>
            {profile.statement}
          </p>
        </section>

        <section className="border-b py-6" style={{ borderColor: "var(--line)" }}>
          <h2 className="mono mb-4" style={{ color: "var(--faint)" }}>
            experience
          </h2>
          {timeline.map((r) => (
            <div key={r.org} className="mb-5 last:mb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <p className="text-[15px] font-medium">
                  {r.role}, {r.org}
                </p>
                <p className="mono" style={{ color: "var(--faint)" }}>
                  {r.period}
                </p>
              </div>
              <ul className="mt-1.5 space-y-0.5">
                {r.highlights.map((h, i) => (
                  <li key={i} className="text-[13.5px]" style={{ color: "var(--dim)" }}>
                    <span style={{ color: "var(--faint)" }}>—</span> {h}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className="border-b py-6" style={{ borderColor: "var(--line)" }}>
          <h2 className="mono mb-4" style={{ color: "var(--faint)" }}>
            selected work
          </h2>
          {projects.map((p) => (
            <div key={p.slug} className="mb-5 last:mb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <p className="text-[15px] font-medium">{p.name}</p>
                <p className="mono" style={{ color: "var(--faint)" }}>
                  {p.client} · {p.year}
                </p>
              </div>
              <p className="mt-1 text-[14px]" style={{ color: "var(--dim)" }}>
                {p.tagline}
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {p.metrics.map((m) => (
                  <li key={m.label} className="text-[13.5px]" style={{ color: "var(--dim)" }}>
                    <span style={{ color: "var(--faint)" }}>—</span> {m.label}:{" "}
                    <span style={{ color: "var(--ink)" }}>{m.value}</span>
                    {m.note ? ` (${m.note})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className="py-6">
          <h2 className="mono mb-3" style={{ color: "var(--faint)" }}>
            tools
          </h2>
          <p className="text-[14px]" style={{ color: "var(--dim)" }}>
            {skills.join(" · ")}
          </p>
          <p className="mono mt-8 no-print" style={{ color: "var(--faint)" }}>
            ⌘P prints this cleanly — one page, no grid, no colour.
          </p>
        </section>
      </div>
    </Page>
  );
}
