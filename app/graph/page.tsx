import type { Metadata } from "next";
import { markRoute } from "@/lib/trace";
import { buildGraph, graphStats } from "@/lib/graph";
import { Page, PageHead, Stat, SectionTitle } from "@/components/ui";
import { GraphExplorer } from "@/components/graph-explorer";

export const metadata: Metadata = {
  title: "Knowledge graph",
  description:
    "Every technology, project, employer and architecture decision as one connected graph — derived from the site's own content and used to expand retrieval.",
  alternates: { canonical: "/graph" },
};

export default async function GraphPage() {
  markRoute("/graph");
  const graph = await buildGraph();
  const stats = graphStats(graph);

  return (
    <Page>
      <PageHead
        label="knowledge graph"
        title="A skills list is a graph someone flattened."
        lede="Technologies, projects, employers and decisions, with the edges left in. Built from the same content files that render every other page, and used to expand retrieval on /ask by one hop."
        aside={
          <div className="grid grid-cols-3 gap-6 lg:grid-cols-1 lg:gap-4">
            <Stat value={String(stats.nodes)} label="entities" tone="signal" />
            <Stat value={String(stats.edges)} label="relationships" />
            <Stat value={`${(stats.density * 100).toFixed(1)}%`} label="density" />
          </div>
        }
      />

      <section className="py-10">
        <GraphExplorer
          nodes={graph.nodes.map((n) => ({
            id: n.id,
            label: n.label,
            type: n.type,
            weight: n.weight,
            href: n.href,
            detail: n.detail,
          }))}
          edges={graph.edges.map((e) => ({
            source: e.source,
            target: e.target,
            rel: e.rel,
          }))}
        />
      </section>

      <section className="grid gap-10 border-t py-10 md:grid-cols-2" style={{ borderColor: "var(--line)" }}>
        <div>
          <SectionTitle>composition</SectionTitle>
          <dl className="space-y-1.5">
            {stats.byType.map((t) => (
              <div
                key={t.type}
                className="flex items-baseline justify-between gap-3 border-b pb-1.5"
                style={{ borderColor: "var(--line)" }}
              >
                <dt className="mono" style={{ color: "var(--dim)" }}>
                  {t.type}
                </dt>
                <dd className="num text-[13px]">{t.count}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <SectionTitle>most connected</SectionTitle>
          <dl className="space-y-1.5">
            {stats.mostConnected.map((n) => (
              <div
                key={n.id}
                className="flex items-baseline justify-between gap-3 border-b pb-1.5"
                style={{ borderColor: "var(--line)" }}
              >
                <dt className="truncate text-[13.5px]" style={{ color: "var(--dim)" }}>
                  {n.label}
                </dt>
                <dd className="num shrink-0 text-[13px]" style={{ color: "var(--signal)" }}>
                  {n.weight} edges
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </Page>
  );
}
