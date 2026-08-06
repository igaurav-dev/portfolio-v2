"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Span, SpanKind } from "@/lib/trace";

interface ServerTrace {
  id: string;
  route?: string;
  region: string;
  runtime: string;
  spans: Span[];
}

interface ClientTiming {
  label: string;
  value: number;
  hint: string;
}

const KIND_COLOR: Record<SpanKind, string> = {
  render: "var(--signal)",
  io: "#7dd3fc",
  compute: "#c4b5fd",
  net: "#fbbf24",
  cache: "#6ee7b7",
  llm: "#f0abfc",
};

function ms(n: number): string {
  if (n < 1) return `${n.toFixed(2)}ms`;
  if (n < 100) return `${n.toFixed(1)}ms`;
  return `${Math.round(n)}ms`;
}

export function TraceStrip({ traceId }: { traceId: string }) {
  const [trace, setTrace] = useState<ServerTrace | null>(null);
  const [client, setClient] = useState<ClientTiming[]>([]);
  const [open, setOpen] = useState(false);
  const lcpRef = useRef<number>(0);

  const pull = useCallback(async () => {
    try {
      const res = await fetch(`/api/trace?id=${traceId}`, { cache: "no-store" });
      if (res.ok) setTrace(await res.json());
    } catch {
      /* the strip is diagnostic; it must never break the page */
    }
  }, [traceId]);

  useEffect(() => {
    if (document.readyState === "complete") void pull();
    else window.addEventListener("load", () => void pull(), { once: true });
  }, [pull]);

  useEffect(() => {
    let observer: PerformanceObserver | undefined;
    try {
      observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) lcpRef.current = last.startTime;
      });
      observer.observe({ type: "largest-contentful-paint", buffered: true });
    } catch {
      /* unsupported */
    }

    const collect = () => {
      const nav = performance.getEntriesByType(
        "navigation",
      )[0] as PerformanceNavigationTiming | undefined;
      const fcp = performance
        .getEntriesByType("paint")
        .find((e) => e.name === "first-contentful-paint");

      const rows: ClientTiming[] = [];
      if (nav) {
        rows.push({
          label: "ttfb",
          value: nav.responseStart - nav.requestStart,
          hint: "request sent → first byte back",
        });
        rows.push({
          label: "download",
          value: nav.responseEnd - nav.responseStart,
          hint: "first byte → last byte of the document",
        });
        rows.push({
          label: "dom",
          value: nav.domContentLoadedEventEnd - nav.responseEnd,
          hint: "parse and hydrate",
        });
        rows.push({
          label: "transfer",
          value: nav.transferSize / 1024,
          hint: "document bytes over the wire (KB)",
        });
      }
      if (fcp) rows.push({ label: "fcp", value: fcp.startTime, hint: "first contentful paint" });
      if (lcpRef.current)
        rows.push({ label: "lcp", value: lcpRef.current, hint: "largest contentful paint" });

      setClient(rows.filter((r) => Number.isFinite(r.value) && r.value >= 0));
    };

    const t = setTimeout(collect, 900);
    return () => {
      clearTimeout(t);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      if (e.key === "t" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const spans = trace?.spans ?? [];
  const total = spans.reduce((m, s) => Math.max(m, s.start + s.duration), 0);
  const io = spans.filter((s) => s.kind === "io").length;

  return (
    <div className="no-print fixed inset-x-0 bottom-0 z-40 pointer-events-none">
      {open && (
        <div className="pointer-events-auto mx-auto max-w-[1180px] px-4 pb-1">
          <div
            className="panel reveal overflow-hidden"
            style={{ background: "color-mix(in srgb, var(--panel) 96%, transparent)", backdropFilter: "blur(12px)" }}
          >
            <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: "var(--line)" }}>
              <span className="mono" style={{ color: "var(--faint)" }}>
                server waterfall · trace {trace?.id ?? "…"}
              </span>
              <span className="mono" style={{ color: "var(--faint)" }}>
                {trace?.runtime} · {trace?.region}
              </span>
            </div>

            <div className="max-h-[38vh] overflow-y-auto px-4 py-3">
              {spans.length === 0 && (
                <p className="mono py-4 text-center" style={{ color: "var(--faint)" }}>
                  no server spans recorded for this navigation
                </p>
              )}
              {spans.map((s, i) => (
                <div key={i} className="group grid grid-cols-[1fr_auto] items-center gap-3 py-[3px]">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span
                        className="num truncate text-[12px]"
                        style={{ color: "var(--ink)" }}
                        title={s.detail}
                      >
                        {s.name}
                      </span>
                      <span className="mono shrink-0" style={{ color: KIND_COLOR[s.kind] }}>
                        {s.kind}
                      </span>
                    </div>
                    <div
                      className="relative mt-[3px] h-[3px] w-full overflow-hidden rounded-full"
                      style={{ background: "var(--raised)" }}
                    >
                      <div
                        className="absolute inset-y-0 rounded-full"
                        style={{
                          left: `${total ? (s.start / total) * 100 : 0}%`,
                          width: `${total ? Math.max((s.duration / total) * 100, 0.8) : 0}%`,
                          background: s.error ? "var(--dead)" : KIND_COLOR[s.kind],
                        }}
                      />
                    </div>
                  </div>
                  <span className="num shrink-0 text-[12px]" style={{ color: "var(--dim)" }}>
                    {ms(s.duration)}
                  </span>
                </div>
              ))}
            </div>

            {client.length > 0 && (
              <div className="border-t px-4 py-3" style={{ borderColor: "var(--line)" }}>
                <span className="mono" style={{ color: "var(--faint)" }}>
                  measured in your browser
                </span>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
                  {client.map((c) => (
                    <span key={c.label} className="num text-[12px]" title={c.hint}>
                      <span className="mono" style={{ color: "var(--faint)" }}>
                        {c.label}
                      </span>{" "}
                      <span style={{ color: "var(--ink)" }}>
                        {c.label === "transfer" ? `${c.value.toFixed(1)}KB` : ms(c.value)}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto group flex w-full items-center gap-3 border-t px-4 py-2 text-left transition-colors"
        style={{
          background: "color-mix(in srgb, var(--bg) 88%, transparent)",
          backdropFilter: "blur(10px)",
          borderColor: "var(--line)",
        }}
        aria-expanded={open}
        aria-label="Toggle request trace"
      >
        <span className="mx-auto flex max-w-[1160px] flex-1 items-center gap-3">
          <span className="pulse-dot" aria-hidden />
          <span className="mono" style={{ color: "var(--faint)" }}>
            this page
          </span>
          <span className="num text-[12px]" style={{ color: "var(--ink)" }}>
            {trace ? ms(total) : "…"}
          </span>
          <span className="mono hidden sm:inline" style={{ color: "var(--faint)" }}>
            {spans.length} spans · {io} disk reads · {trace?.region ?? "—"}
          </span>
          <span className="ml-auto mono flex items-center gap-2" style={{ color: "var(--faint)" }}>
            <span className="hidden md:inline">press</span>
            <kbd
              className="rounded border px-1.5 py-0.5 text-[10px]"
              style={{ borderColor: "var(--line-bright)", color: "var(--dim)" }}
            >
              T
            </kbd>
            <span>{open ? "close" : "trace"}</span>
          </span>
        </span>
      </button>
    </div>
  );
}
