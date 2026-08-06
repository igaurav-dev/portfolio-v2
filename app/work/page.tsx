import Link from "next/link";
import type { Metadata } from "next";
import { getProjects } from "@/lib/content";
import { markRoute } from "@/lib/trace";
import { Page, PageHead, Tag } from "@/components/ui";

export const metadata: Metadata = { title: "Work" };

export default async function WorkPage() {
  markRoute("/work");
  const projects = await getProjects();

  return (
    <Page>
      <PageHead
        label="work"
        title="Four systems, and what each one cost to learn."
        lede="Every case study ends with a section called what went wrong. Those are the parts I'd actually want to be asked about."
      />

      <div className="py-4">
        {projects.map((p) => (
          <Link
            key={p.slug}
            href={`/work/${p.slug}`}
            className="row grid gap-4 border-b py-8 pl-4 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:gap-12"
            style={{ borderColor: "var(--line)" }}
          >
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="text-[19px] font-medium tracking-tight">{p.name}</h2>
                <Tag>{p.year}</Tag>
                <Tag>{p.client}</Tag>
                <Tag tone={p.status === "in production" ? "signal" : "dim"}>{p.status}</Tag>
              </div>
              <p className="max-w-[58ch] text-[15px]" style={{ color: "var(--dim)" }}>
                {p.tagline}
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {p.stack.map((s) => (
                  <Tag key={s}>{s}</Tag>
                ))}
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-y-2 self-start">
              {p.metrics.map((m) => (
                <div key={m.label} className="flex items-baseline justify-between gap-3 border-b pb-1.5" style={{ borderColor: "var(--line)" }}>
                  <dt className="mono truncate" style={{ color: "var(--faint)" }}>
                    {m.label}
                  </dt>
                  <dd className="num shrink-0 text-[12.5px]" style={{ color: "var(--signal)" }}>
                    {m.value}
                  </dd>
                </div>
              ))}
            </dl>
          </Link>
        ))}
      </div>
    </Page>
  );
}
