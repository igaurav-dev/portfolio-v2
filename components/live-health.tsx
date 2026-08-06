"use client";

import { useEffect, useState } from "react";

interface Check {
  name: string;
  ok: boolean;
  optional: boolean;
  ms: number;
  error: string | null;
}

interface Health {
  status: "ok" | "degraded";
  degraded: string[];
  unconfigured: string[];
  checks: Check[];
  uptimeSeconds: number;
  node: string;
  at: string;
}

const NODES = [
  { id: "browser", label: "Your browser", sub: "paint + hydrate", check: null },
  { id: "edge", label: "Edge", sub: "TLS + routing", check: null },
  { id: "render", label: "RSC render", sub: "react server components", check: "compute.hash" },
  { id: "content", label: "Content", sub: "json on disk", check: "content.disk" },
  { id: "index", label: "BM25 index", sub: "in-process memory", check: "json.parse" },
  { id: "cache", label: "Semantic cache", sub: "similar questions", check: null },
  { id: "store", label: "Store", sub: "checkins + cache", check: "store" },
  { id: "llm", label: "Anthropic API", sub: "only novel questions", check: "llm.credential" },
] as const;

export function LiveHealth() {
  const [health, setHealth] = useState<Health | null>(null);
  const [pending, setPending] = useState(true);
  const [lastRtt, setLastRtt] = useState(0);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      const t0 = performance.now();
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const data = (await res.json()) as Health;
        if (!alive) return;
        setHealth(data);
        setLastRtt(performance.now() - t0);
      } catch {
        /* leave the previous reading in place */
      } finally {
        if (alive) setPending(false);
      }
    };
    void poll();
    const id = setInterval(poll, 10_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // the store check is named after whichever backend is live
  const byName = new Map((health?.checks ?? []).map((c) => [c.name, c]));
  for (const c of health?.checks ?? [])
    if (c.name.startsWith("store.")) byName.set("store", c);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="pulse-dot" aria-hidden />
        <span className="mono" style={{ color: health?.status === "degraded" ? "var(--dead)" : "var(--signal)" }}>
          {pending ? "probing…" : health?.status === "degraded" ? "degraded" : "all systems nominal"}
        </span>
        <span className="mono" style={{ color: "var(--faint)" }}>
          polled every 10s · last round trip {lastRtt.toFixed(0)}ms
        </span>
      </div>

      {/* request path */}
      <div className="flex flex-wrap items-stretch gap-2">
        {NODES.map((node, i) => {
          const check = node.check ? byName.get(node.check) : undefined;
          const state = !node.check
            ? "static"
            : check?.ok
              ? "ok"
              : check?.optional
                ? "off"
                : check
                  ? "down"
                  : "unknown";
          const color =
            state === "ok"
              ? "var(--signal)"
              : state === "down"
                ? "var(--dead)"
                : "var(--faint)";

          return (
            <div key={node.id} className="flex items-stretch gap-2">
              <div
                className="panel relative min-w-[9.5rem] overflow-hidden px-3 py-2.5"
                style={{ borderColor: state === "down" ? "var(--dead)" : "var(--line)" }}
              >
                {pending && (
                  <div className="scan absolute inset-y-0 left-0 w-1/3" aria-hidden />
                )}
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: color }}
                    aria-hidden
                  />
                  <span className="text-[13px] font-medium">{node.label}</span>
                </div>
                <p className="mono mt-1" style={{ color: "var(--faint)" }}>
                  {node.sub}
                </p>
                <p className="num mt-1.5 text-[12px]" style={{ color }}>
                  {!check
                    ? "—"
                    : check.ok
                      ? `${check.ms.toFixed(1)}ms`
                      : check.optional
                        ? "not configured"
                        : "unavailable"}
                </p>
              </div>
              {i < NODES.length - 1 && (
                <span
                  className="self-center px-0.5"
                  style={{ color: "var(--faint)" }}
                  aria-hidden
                >
                  →
                </span>
              )}
            </div>
          );
        })}
      </div>

      {health && health.checks.some((c) => !c.ok) && (
        <div
          className="mt-5 border-l-2 pl-4"
          style={{
            borderColor: health.degraded.length ? "var(--dead)" : "var(--line-bright)",
          }}
        >
          {health.checks
            .filter((c) => !c.ok)
            .map((c) => (
              <p key={c.name} className="text-[13.5px]" style={{ color: "var(--dim)" }}>
                <span
                  className="mono"
                  style={{ color: c.optional ? "var(--faint)" : "var(--dead)" }}
                >
                  {c.name}
                </span>{" "}
                — {c.error}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
