import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getProject, getProjects, getDecisions } from "@/lib/content";
import { markRoute } from "@/lib/trace";
import { Page, Tag, Callout, ArrowLink } from "@/components/ui";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProject(slug);
  return {
    title: project?.name ?? "Not found",
    description: project?.tagline,
  };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  markRoute("/work/[slug]");
  const project = await getProject(slug);
  if (!project) notFound();

  const [all, decisions] = await Promise.all([getProjects(), getDecisions()]);
  const related = decisions.filter((d) => d.project === slug);
  const index = all.findIndex((p) => p.slug === slug);
  const next = all[(index + 1) % all.length];

  return (
    <Page>
      <article>
        <header className="reveal border-b py-14 sm:py-20" style={{ borderColor: "var(--line)" }}>
          <p className="mono mb-4" style={{ color: "var(--signal)" }}>
            {project.client} · {project.year} · {project.role} · {project.duration}
          </p>
          <h1 className="display max-w-[14ch]">{project.name}</h1>
          <p className="prose-body mt-5 text-[17px]">{project.tagline}</p>
          <div className="mt-6 flex flex-wrap gap-1.5">
            {project.stack.map((s) => (
              <Tag key={s}>{s}</Tag>
            ))}
          </div>
        </header>

        <section className="grid gap-x-12 gap-y-3 border-b py-10 md:grid-cols-[10rem_1fr]" style={{ borderColor: "var(--line)" }}>
          <h2 className="mono" style={{ color: "var(--faint)" }}>
            summary
          </h2>
          <p className="prose-body">{project.summary}</p>
        </section>

        <section className="grid gap-x-12 gap-y-3 border-b py-10 md:grid-cols-[10rem_1fr]" style={{ borderColor: "var(--line)" }}>
          <h2 className="mono" style={{ color: "var(--faint)" }}>
            the problem
          </h2>
          <p className="prose-body">{project.problem}</p>
        </section>

        <section className="grid gap-x-12 gap-y-3 border-b py-10 md:grid-cols-[10rem_1fr]" style={{ borderColor: "var(--line)" }}>
          <h2 className="mono" style={{ color: "var(--faint)" }}>
            approach
          </h2>
          <ol className="max-w-[64ch] space-y-4">
            {project.approach.map((step, i) => (
              <li key={i} className="grid grid-cols-[2rem_1fr] gap-2">
                <span className="num pt-0.5 text-[12px]" style={{ color: "var(--signal)" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[15px]" style={{ color: "var(--dim)" }}>
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-x-12 gap-y-5 border-b py-10 md:grid-cols-[10rem_1fr]" style={{ borderColor: "var(--line)" }}>
          <h2 className="mono" style={{ color: "var(--faint)" }}>
            results
          </h2>
          <dl className="grid gap-5 sm:grid-cols-3">
            {project.metrics.map((m) => (
              <div key={m.label}>
                <dt className="mono mb-2" style={{ color: "var(--faint)" }}>
                  {m.label}
                </dt>
                <dd>
                  <p className="num text-[21px]" style={{ color: "var(--signal)" }}>
                    {m.value}
                  </p>
                  {m.note && (
                    <p className="mono mt-1" style={{ color: "var(--faint)" }}>
                      {m.note}
                    </p>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="grid gap-x-12 gap-y-3 border-b py-10 md:grid-cols-[10rem_1fr]" style={{ borderColor: "var(--line)" }}>
          <h2 className="mono" style={{ color: "var(--signal)" }}>
            trade-offs
          </h2>
          <Callout>
            <p className="prose-body">{project.tradeoffs}</p>
          </Callout>
        </section>

        {project.wentWrong.trim() && (
          <section className="grid gap-x-12 gap-y-3 border-b py-10 md:grid-cols-[10rem_1fr]" style={{ borderColor: "var(--line)" }}>
            <h2 className="mono" style={{ color: "var(--dead)" }}>
              what went wrong
            </h2>
            <Callout tone="dead">
              <p className="prose-body">{project.wentWrong}</p>
            </Callout>
          </section>
        )}

        {related.length > 0 && (
          <section className="grid gap-x-12 gap-y-4 py-10 md:grid-cols-[10rem_1fr]">
            <h2 className="mono" style={{ color: "var(--faint)" }}>
              decisions
            </h2>
            <div className="max-w-[64ch]">
              {related.map((d) => (
                <Link
                  key={d.id}
                  href={`/decisions#${d.id}`}
                  className="row block border-b py-4 pl-4"
                  style={{ borderColor: "var(--line)" }}
                >
                  <p className="text-[15px] font-medium">{d.title}</p>
                  <p className="mono mt-1" style={{ color: "var(--faint)" }}>
                    {d.alternatives.length} alternatives considered · {d.date}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <nav className="hairline flex items-center justify-between gap-4 py-8">
          <ArrowLink href="/work">All work</ArrowLink>
          <ArrowLink href={`/work/${next.slug}`}>{next.name}</ArrowLink>
        </nav>
      </article>
    </Page>
  );
}
