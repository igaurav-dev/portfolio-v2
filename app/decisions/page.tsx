import Link from "next/link";
import type { Metadata } from "next";
import { getDecisions, getProjects } from "@/lib/content";
import { markRoute } from "@/lib/trace";
import { Page, PageHead, Tag } from "@/components/ui";

export const metadata: Metadata = {
  title: "Decisions",
  description:
    "Architecture decision records: the option chosen, the options rejected, and what each trade-off cost. APIM policy layers, Managed Identity, embedding-based deduplication, Recursive Language Models.",
  alternates: { canonical: "/decisions" },
};

export default async function DecisionsPage() {
  markRoute("/decisions");
  const [decisions, projects] = await Promise.all([getDecisions(), getProjects()]);
  const nameOf = new Map(projects.map((p) => [p.slug, p.name]));

  return (
    <Page>
      <PageHead
        label="decisions"
        title="Every decision, with the options it beat."
        lede="A decision without its discarded alternatives isn't reviewable — it's just a fact the next engineer has to live with. These are the real records: what was chosen, what was rejected and why, and what the choice cost."
        aside={
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-1 lg:gap-4">
            <div>
              <p className="num text-[22px]" style={{ color: "var(--signal)" }}>
                {decisions.length}
              </p>
              <p className="mono mt-1" style={{ color: "var(--faint)" }}>
                records
              </p>
            </div>
            <div>
              <p className="num text-[22px]">
                {decisions.reduce((n, d) => n + d.alternatives.length, 0)}
              </p>
              <p className="mono mt-1" style={{ color: "var(--faint)" }}>
                alternatives weighed
              </p>
            </div>
          </div>
        }
      />

      <div className="py-4">
        {decisions.map((d) => (
          <article
            key={d.id}
            id={d.id}
            className="scroll-mt-24 border-b py-12"
            style={{ borderColor: "var(--line)" }}
          >
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="mono num" style={{ color: "var(--signal)" }}>
                {d.date}
              </span>
              <Tag tone="signal">{d.status}</Tag>
              <Link href={`/work/${d.project}`}>
                <Tag>{nameOf.get(d.project) ?? d.project}</Tag>
              </Link>
            </div>

            <h2 className="max-w-[26ch] text-[22px] font-medium leading-tight tracking-[-0.02em]">
              {d.title}
            </h2>

            <div className="mt-7 grid gap-x-12 gap-y-7 lg:grid-cols-2">
              <div>
                <p className="mono mb-2" style={{ color: "var(--faint)" }}>
                  context
                </p>
                <p className="prose-body max-w-none text-[14.5px]">{d.context}</p>

                <p className="mono mb-2 mt-6" style={{ color: "var(--signal)" }}>
                  decision
                </p>
                <p
                  className="border-l-2 pl-4 text-[14.5px] leading-relaxed"
                  style={{ borderColor: "var(--signal)", color: "var(--ink)" }}
                >
                  {d.decision}
                </p>
              </div>

              <div>
                <p className="mono mb-3" style={{ color: "var(--faint)" }}>
                  alternatives considered
                </p>
                <div className="space-y-3">
                  {d.alternatives.map((a) => (
                    <div
                      key={a.option}
                      className="border-b pb-3"
                      style={{ borderColor: "var(--line)" }}
                    >
                      <p className="flex items-baseline gap-2 text-[14px] font-medium">
                        <span style={{ color: "var(--dead)" }} aria-hidden>
                          ✕
                        </span>
                        {a.option}
                      </p>
                      <p className="mt-1 text-[13.5px]" style={{ color: "var(--dim)" }}>
                        {a.why}
                      </p>
                    </div>
                  ))}
                </div>

                <p className="mono mb-2 mt-6" style={{ color: "var(--faint)" }}>
                  consequence
                </p>
                <p className="text-[14px]" style={{ color: "var(--dim)" }}>
                  {d.consequence}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <p className="prose-body py-10">
        This page exists because the most useful thing a senior engineer leaves
        behind is not the system — it&rsquo;s the reasoning. Anyone can read the
        infrastructure and see what was built. Only a record like this tells you
        what was considered and discarded, which is the part that stops the next
        person re-litigating a settled question.
      </p>
    </Page>
  );
}
