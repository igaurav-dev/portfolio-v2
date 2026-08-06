import { cache } from "react";

/* ------------------------------------------------------------------
   THE GLASS BOX
   A small, real tracer. Every server-side unit of work on this site
   opens a span. The strip at the bottom of the page is reading these
   exact numbers — nothing here is decorative.
   ------------------------------------------------------------------ */

export type SpanKind = "render" | "io" | "compute" | "net" | "cache" | "llm";

export interface Span {
  name: string;
  kind: SpanKind;
  /** ms from the start of the trace */
  start: number;
  /** ms */
  duration: number;
  detail?: string;
  error?: boolean;
}

export interface TraceStore {
  id: string;
  startedAt: number;
  origin: number;
  spans: Span[];
  route?: string;
  region: string;
  runtime: string;
}

interface Registry {
  traces: Map<string, TraceStore>;
  order: string[];
  served: number;
  bootedAt: number;
}

const MAX_TRACES = 250;

function registry(): Registry {
  const g = globalThis as unknown as { __glassbox?: Registry };
  if (!g.__glassbox) {
    g.__glassbox = {
      traces: new Map(),
      order: [],
      served: 0,
      bootedAt: Date.now(),
    };
  }
  return g.__glassbox;
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function newId(): string {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = (Math.random() * 256) | 0;
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Per-request singleton. React's `cache()` scopes this to a single server
 * render pass, which is exactly the lifetime of one trace.
 */
export const getTrace = cache((): TraceStore => {
  const reg = registry();
  const store: TraceStore = {
    id: newId(),
    startedAt: Date.now(),
    origin: now(),
    spans: [],
    region:
      process.env.VERCEL_REGION ??
      process.env.FLY_REGION ??
      process.env.AWS_REGION ??
      "local",
    runtime: process.env.NEXT_RUNTIME ?? "nodejs",
  };

  reg.traces.set(store.id, store);
  reg.order.push(store.id);
  reg.served += 1;

  while (reg.order.length > MAX_TRACES) {
    const evicted = reg.order.shift();
    if (evicted) reg.traces.delete(evicted);
  }

  return store;
});

/** Wrap any async unit of work in a named span. */
export async function span<T>(
  name: string,
  kind: SpanKind,
  fn: () => Promise<T> | T,
  detail?: string,
): Promise<T> {
  let store: TraceStore | null = null;
  try {
    store = getTrace();
  } catch {
    // Called outside a React render (route handler, script). Still run the work.
  }

  const t0 = now();
  try {
    const result = await fn();
    store?.spans.push({
      name,
      kind,
      start: t0 - store.origin,
      duration: now() - t0,
      detail,
    });
    return result;
  } catch (err) {
    store?.spans.push({
      name,
      kind,
      start: t0 - store.origin,
      duration: now() - t0,
      detail: err instanceof Error ? err.message : String(err),
      error: true,
    });
    throw err;
  }
}

export function markRoute(route: string): void {
  try {
    getTrace().route = route;
  } catch {
    /* not in a render */
  }
}

export function readTrace(id: string): TraceStore | null {
  return registry().traces.get(id) ?? null;
}

/* ---------------- aggregate telemetry, for /status ---------------- */

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export interface Telemetry {
  sampled: number;
  servedTotal: number;
  uptimeSeconds: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  errorRate: number;
  spansPerRequest: number;
  byKind: { kind: SpanKind; totalMs: number; count: number }[];
  hotRoutes: { route: string; count: number; p50: number }[];
  heapUsedMb: number;
  rssMb: number;
  nodeVersion: string;
}

export function telemetry(): Telemetry {
  const reg = registry();
  const traces = [...reg.traces.values()];

  const totals = traces
    .map((t) => t.spans.reduce((max, s) => Math.max(max, s.start + s.duration), 0))
    .filter((n) => n > 0)
    .sort((a, b) => a - b);

  const kinds = new Map<SpanKind, { totalMs: number; count: number }>();
  let spanCount = 0;
  let errored = 0;

  for (const t of traces) {
    for (const s of t.spans) {
      spanCount++;
      if (s.error) errored++;
      const entry = kinds.get(s.kind) ?? { totalMs: 0, count: 0 };
      entry.totalMs += s.duration;
      entry.count += 1;
      kinds.set(s.kind, entry);
    }
  }

  const routes = new Map<string, number[]>();
  for (const t of traces) {
    if (!t.route) continue;
    const total = t.spans.reduce((m, s) => Math.max(m, s.start + s.duration), 0);
    const list = routes.get(t.route) ?? [];
    list.push(total);
    routes.set(t.route, list);
  }

  const mem =
    typeof process !== "undefined" && process.memoryUsage
      ? process.memoryUsage()
      : { heapUsed: 0, rss: 0 };

  return {
    sampled: traces.length,
    servedTotal: reg.served,
    uptimeSeconds: Math.round((Date.now() - reg.bootedAt) / 1000),
    p50: quantile(totals, 0.5),
    p95: quantile(totals, 0.95),
    p99: quantile(totals, 0.99),
    max: totals.length ? totals[totals.length - 1] : 0,
    errorRate: spanCount ? errored / spanCount : 0,
    spansPerRequest: traces.length ? spanCount / traces.length : 0,
    byKind: [...kinds.entries()]
      .map(([kind, v]) => ({ kind, ...v }))
      .sort((a, b) => b.totalMs - a.totalMs),
    hotRoutes: [...routes.entries()]
      .map(([route, list]) => ({
        route,
        count: list.length,
        p50: quantile([...list].sort((a, b) => a - b), 0.5),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    heapUsedMb: mem.heapUsed / 1024 / 1024,
    rssMb: mem.rss / 1024 / 1024,
    nodeVersion: typeof process !== "undefined" ? process.version : "unknown",
  };
}
