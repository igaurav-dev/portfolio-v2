import type { Metadata } from "next";
import { getDeltas, getProfile } from "@/lib/content";
import { markRoute } from "@/lib/trace";
import { Page, PageHead, Tag, ArrowLink } from "@/components/ui";

export const metadata: Metadata = {
  title: "Growth",
  description:
    "A diff of every résumé revision — what was newly learned, what was added, and what changed. Generated automatically when a new résumé is uploaded.",
  alternates: { canonical: "/growth" },
};

export default async function GrowthPage() {
  markRoute("/growth");
  const [deltas, profile] = await Promise.all([getDeltas(), getProfile()]);

  return (
    <Page>
      <PageHead
        label="growth"
        title="What changed since the last résumé."
        lede="Every time a new résumé is uploaded through the admin panel, it is diffed against the current corpus and the difference is recorded here. Not a summary written after the fact — a real diff between two versions."
        aside={
          <div>
            <p className="num text-[22px]" style={{ color: "var(--signal)" }}>
              {deltas.reduce((n, d) => n + d.learned.length, 0)}
            </p>
            <p className="mono mt-1" style={{ color: "var(--faint)" }}>
              new capabilities logged
            </p>
          </div>
        }
      />

      {deltas.length === 0 ? (
        <div className="py-16">
          <p className="prose-body">
            No revisions recorded yet. Upload a résumé in the admin panel and the
            first diff appears here — newly acquired technologies, added projects and
            roles, and any metric that moved.
          </p>
          <div className="mt-6">
            <ArrowLink href="/admin">Open the admin panel</ArrowLink>
          </div>
        </div>
      ) : (
        <div className="py-4">
          {deltas.map((d) => (
            <article
              key={d.at}
              className="border-b py-10"
              style={{ borderColor: "var(--line)" }}
            >
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="mono num" style={{ color: "var(--signal)" }}>
                  {d.at.slice(0, 10)}
                </span>
                <Tag>{d.source}</Tag>
              </div>
              <p className="prose-body max-w-[70ch] text-[16px]" style={{ color: "var(--ink)" }}>
                {d.summary}
              </p>

              <div className="mt-7 grid gap-8 sm:grid-cols-3">
                <div>
                  <p className="mono mb-3" style={{ color: "var(--signal)" }}>
                    newly learned ({d.learned.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {d.learned.map((l) => (
                      <Tag key={l} tone="signal">
                        {l}
                      </Tag>
                    ))}
                    {d.learned.length === 0 && (
                      <span className="mono" style={{ color: "var(--faint)" }}>
                        nothing new
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="mono mb-3" style={{ color: "var(--faint)" }}>
                    added ({d.added.length})
                  </p>
                  <ul className="space-y-1">
                    {d.added.map((a) => (
                      <li key={a} className="text-[13.5px]" style={{ color: "var(--dim)" }}>
                        + {a}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mono mb-3" style={{ color: "var(--faint)" }}>
                    changed ({d.changed.length})
                  </p>
                  <ul className="space-y-1">
                    {d.changed.map((c) => (
                      <li key={c} className="text-[13.5px]" style={{ color: "var(--dim)" }}>
                        ~ {c}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="mono py-10" style={{ color: "var(--faint)" }}>
        diffs are computed against the corpus at upload time · {profile.name}
      </p>
    </Page>
  );
}
