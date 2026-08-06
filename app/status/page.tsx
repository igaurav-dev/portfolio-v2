import type { Metadata } from "next";
import { markRoute, telemetry, span } from "@/lib/trace";
import { buildCorpus } from "@/lib/retrieval";
import { cacheStats } from "@/lib/semantic-cache";
import { budget } from "@/lib/ratelimit";
import { pingDb } from "@/lib/db";
import { Page, PageHead, Stat, SectionTitle } from "@/components/ui";
import { LiveHealth } from "@/components/live-health";

export const metadata: Metadata = {
  title: "Status",
  description: "Live telemetry for this site, computed from the requests it has actually served.",
};

const KIND_COLOR: Record<string, string> = {
  render: "var(--signal)",
  io: "#7dd3fc",
  compute: "#c4b5fd",
  net: "#fbbf24",
  cache: "#6ee7b7",
  llm: "#f0abfc",
};

function duration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  return `${h}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export default async function StatusPage() {
  markRoute("/status");

  // Read the aggregate first so this request's own spans don't skew it.
  const t = await span("telemetry.aggregate", "compute", () => telemetry());
  const [corpus, cache, store] = await Promise.all([
    buildCorpus(),
    Promise.resolve(cacheStats()),
    pingDb(),
  ]);
  const spend = budget();
  const totalKindMs = t.byKind.reduce((s, k) => s + k.totalMs, 0) || 1;

  return (
    <Page>
      <PageHead
        label="status"
        title="The instrument panel."
        lede="Every number below is computed from the requests this server instance has actually handled — including the one that just rendered this page. Percentiles come from a rolling window of the last 250 traces."
      />

      <section className="border-b py-10" style={{ borderColor: "var(--line)" }}>
        <LiveHealth />
      </section>

      <section className="border-b py-10" style={{ borderColor: "var(--line)" }}>
        <SectionTitle count={`n = ${t.sampled}`}>server render latency</SectionTitle>
        <div className="grid grid-cols-2 gap-6 py-4 sm:grid-cols-4">
          <Stat value={`${t.p50.toFixed(1)}ms`} label="p50" tone="signal" />
          <Stat value={`${t.p95.toFixed(1)}ms`} label="p95" />
          <Stat value={`${t.p99.toFixed(1)}ms`} label="p99" />
          <Stat value={`${t.max.toFixed(1)}ms`} label="worst seen" tone={t.max > 400 ? "dead" : "ink"} />
        </div>
        <p className="mono max-w-[70ch]" style={{ color: "var(--faint)" }}>
          this measures span time inside the render, not network. the browser-side
          numbers live in the trace strip — press T.
        </p>
      </section>

      <section className="border-b py-10" style={{ borderColor: "var(--line)" }}>
        <SectionTitle>where the time goes</SectionTitle>
        <div className="flex h-2 w-full overflow-hidden rounded-full py-0" style={{ background: "var(--raised)" }}>
          {t.byKind.map((k) => (
            <div
              key={k.kind}
              style={{
                width: `${(k.totalMs / totalKindMs) * 100}%`,
                background: KIND_COLOR[k.kind] ?? "var(--faint)",
              }}
              title={`${k.kind}: ${k.totalMs.toFixed(1)}ms across ${k.count} spans`}
            />
          ))}
        </div>
        <dl className="mt-5 grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {t.byKind.map((k) => (
            <div key={k.kind} className="flex items-baseline justify-between gap-3 border-b pb-1.5" style={{ borderColor: "var(--line)" }}>
              <dt className="mono flex items-center gap-2">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: KIND_COLOR[k.kind] ?? "var(--faint)" }}
                />
                <span style={{ color: "var(--dim)" }}>{k.kind}</span>
              </dt>
              <dd className="num text-[12.5px]" style={{ color: "var(--ink)" }}>
                {k.totalMs.toFixed(1)}ms
                <span className="mono ml-2" style={{ color: "var(--faint)" }}>
                  {k.count} spans
                </span>
              </dd>
            </div>
          ))}
          {t.byKind.length === 0 && (
            <p className="mono" style={{ color: "var(--faint)" }}>
              no spans recorded yet on this instance
            </p>
          )}
        </dl>
      </section>

      <section className="border-b py-10" style={{ borderColor: "var(--line)" }}>
        <SectionTitle>busiest routes on this instance</SectionTitle>
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--line)" }}>
              {["route", "requests", "p50"].map((h, i) => (
                <th
                  key={h}
                  className={`mono py-2 font-normal ${i === 0 ? "text-left" : "text-right"}`}
                  style={{ color: "var(--faint)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {t.hotRoutes.map((r) => (
              <tr key={r.route} className="border-b" style={{ borderColor: "var(--line)" }}>
                <td className="num py-2.5 text-[13px]">{r.route}</td>
                <td className="num py-2.5 text-right text-[13px]" style={{ color: "var(--dim)" }}>
                  {r.count}
                </td>
                <td className="num py-2.5 text-right text-[13px]" style={{ color: "var(--signal)" }}>
                  {r.p50.toFixed(1)}ms
                </td>
              </tr>
            ))}
            {t.hotRoutes.length === 0 && (
              <tr>
                <td colSpan={3} className="mono py-6 text-center" style={{ color: "var(--faint)" }}>
                  you are the first request this instance has seen
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="border-b py-10" style={{ borderColor: "var(--line)" }}>
        <SectionTitle count={`threshold ${(cache.threshold * 100).toFixed(0)}% similarity`}>
          answer cache
        </SectionTitle>
        <div className="grid grid-cols-2 gap-6 py-4 sm:grid-cols-5">
          <Stat value={String(cache.entries)} label="questions cached" />
          <Stat value={`${(cache.hitRate * 100).toFixed(0)}%`} label="reuse rate" tone="signal" />
          <Stat value={String(cache.hits)} label="cache hits" />
          <Stat value={String(cache.misses)} label="api calls" />
          <Stat value={`$${cache.savedUsd.toFixed(4)}`} label="spend avoided" tone="signal" />
        </div>
        <p className="mono max-w-[74ch]" style={{ color: "var(--faint)" }}>
          questions are vectorised and compared against everything already answered.
          only genuinely novel phrasing reaches the model — the rest is served from{" "}
          {cache.persisted ? "the database-backed cache" : "the in-process cache"} for
          nothing. today&rsquo;s spend: ${spend.spentUsd.toFixed(4)} of $
          {spend.budgetUsd.toFixed(2)}.
        </p>
      </section>

      <section className="border-b py-10" style={{ borderColor: "var(--line)" }}>
        <SectionTitle count={store.backend}>store</SectionTitle>
        <div className="grid grid-cols-2 gap-6 py-4 sm:grid-cols-3">
          <Stat value={store.backend} label="backend" tone={store.ok ? "signal" : "dead"} />
          <Stat value={`${store.latencyMs.toFixed(1)}ms`} label="ping" />
          <Stat value={store.ok ? "reachable" : "down"} label="state" tone={store.ok ? "ink" : "dead"} />
        </div>
        <p className="mono max-w-[74ch]" style={{ color: "var(--faint)" }}>
          {store.detail}
        </p>
      </section>

      <section className="py-10">
        <SectionTitle>process</SectionTitle>
        <div className="grid grid-cols-2 gap-6 py-4 sm:grid-cols-3 lg:grid-cols-6">
          <Stat value={String(t.servedTotal)} label="renders served" />
          <Stat value={duration(t.uptimeSeconds)} label="instance uptime" />
          <Stat value={`${t.heapUsedMb.toFixed(1)}MB`} label="heap used" />
          <Stat value={`${t.rssMb.toFixed(0)}MB`} label="rss" />
          <Stat value={String(corpus.length)} label="corpus chunks" />
          <Stat value={t.nodeVersion} label="node" />
        </div>
        <p className="mono mt-4 max-w-[74ch]" style={{ color: "var(--faint)" }}>
          these counters are per instance and reset on cold start. on a multi-instance
          deploy you are seeing one machine&rsquo;s view, which is the honest thing to
          show rather than a number aggregated from somewhere you cannot check.
        </p>
      </section>
    </Page>
  );
}
