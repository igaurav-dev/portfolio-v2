"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export interface ViewNode {
  id: string;
  label: string;
  type: string;
  weight: number;
  href?: string;
  detail?: string;
}
export interface ViewEdge {
  source: string;
  target: string;
  rel: string;
}

interface Sim extends ViewNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fixed: boolean;
}

const TYPE_COLOR: Record<string, string> = {
  person: "#d8ff3e",
  company: "#fbbf24",
  project: "#7dd3fc",
  tech: "#c4b5fd",
  category: "#6ee7b7",
  decision: "#f0abfc",
};

const W = 900;
const H = 620;

export function GraphExplorer({
  nodes,
  edges,
}: {
  nodes: ViewNode[];
  edges: ViewEdge[];
}) {
  const router = useRouter();
  const [focus, setFocus] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [, setTick] = useState(0);

  const simRef = useRef<Sim[]>([]);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const frameRef = useRef<number>(0);

  const types = useMemo(() => [...new Set(nodes.map((n) => n.type))].sort(), [nodes]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return new Set(
      nodes
        .filter((n) => !hidden.has(n.type))
        .filter((n) => !q || n.label.toLowerCase().includes(q))
        .map((n) => n.id),
    );
  }, [nodes, hidden, query]);

  const adjacency = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const e of edges) {
      if (!map.has(e.source)) map.set(e.source, new Set());
      if (!map.has(e.target)) map.set(e.target, new Set());
      map.get(e.source)!.add(e.target);
      map.get(e.target)!.add(e.source);
    }
    return map;
  }, [edges]);

  const highlighted = useMemo(() => {
    if (!focus) return null;
    const set = new Set(adjacency.get(focus) ?? []);
    set.add(focus);
    return set;
  }, [focus, adjacency]);

  // initialise positions once, seeded so the layout is stable across renders
  useEffect(() => {
    simRef.current = nodes.map((n, i) => {
      const angle = (i / nodes.length) * Math.PI * 2;
      const radius = n.type === "person" ? 0 : 140 + ((i * 37) % 160);
      return {
        ...n,
        x: W / 2 + Math.cos(angle) * radius,
        y: H / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        fixed: n.type === "person",
      };
    });
  }, [nodes]);

  // force simulation
  useEffect(() => {
    const REPULSION = 5200;
    const SPRING = 0.011;
    const REST = 78;
    const DAMPING = 0.86;
    const CENTER = 0.0016;
    let alpha = 1;

    const step = () => {
      const sim = simRef.current;
      const index = new Map(sim.map((n) => [n.id, n]));

      for (let i = 0; i < sim.length; i++) {
        const a = sim[i];
        if (a.fixed) {
          a.x = W / 2;
          a.y = H / 2;
          continue;
        }
        for (let j = i + 1; j < sim.length; j++) {
          const b = sim[j];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) {
            dx = (i - j) * 0.6 || 0.6;
            dy = 0.6;
            d2 = 1;
          }
          const force = (REPULSION * alpha) / d2;
          const d = Math.sqrt(d2);
          a.vx += (dx / d) * force;
          a.vy += (dy / d) * force;
          b.vx -= (dx / d) * force;
          b.vy -= (dy / d) * force;
        }
        a.vx += (W / 2 - a.x) * CENTER;
        a.vy += (H / 2 - a.y) * CENTER;
      }

      for (const e of edges) {
        const a = index.get(e.source);
        const b = index.get(e.target);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (d - REST) * SPRING * alpha;
        const fx = (dx / d) * force;
        const fy = (dy / d) * force;
        if (!a.fixed) {
          a.vx += fx;
          a.vy += fy;
        }
        if (!b.fixed) {
          b.vx -= fx;
          b.vy -= fy;
        }
      }

      for (const n of sim) {
        if (n.fixed) continue;
        n.vx *= DAMPING;
        n.vy *= DAMPING;
        n.x = Math.max(28, Math.min(W - 28, n.x + n.vx));
        n.y = Math.max(24, Math.min(H - 24, n.y + n.vy));
      }

      alpha = Math.max(0.06, alpha * 0.994);
      setTick((t) => (t + 1) % 1_000_000);
      frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [edges]);

  const toSvg = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  }, []);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const node = simRef.current.find((n) => n.id === drag.id);
      if (!node) return;
      const { x, y } = toSvg(e.clientX, e.clientY);
      node.x = x - drag.dx;
      node.y = y - drag.dy;
      node.vx = 0;
      node.vy = 0;
    };
    const up = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [toSvg]);

  const sim = simRef.current;
  const byId = new Map(sim.map((n) => [n.id, n]));
  const focused = focus ? nodes.find((n) => n.id === focus) : null;
  const focusedNeighbours = focus
    ? [...(adjacency.get(focus) ?? [])]
        .map((id) => nodes.find((n) => n.id === id))
        .filter((n): n is ViewNode => Boolean(n))
        .sort((a, b) => a.type.localeCompare(b.type))
    : [];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="filter nodes…"
          className="rounded border bg-transparent px-2.5 py-1 text-[13px] outline-none"
          style={{ borderColor: "var(--line-bright)", color: "var(--ink)" }}
        />
        {types.map((t) => {
          const off = hidden.has(t);
          return (
            <button
              key={t}
              onClick={() =>
                setHidden((prev) => {
                  const next = new Set(prev);
                  if (next.has(t)) next.delete(t);
                  else next.add(t);
                  return next;
                })
              }
              className="mono flex items-center gap-1.5 rounded border px-2 py-1"
              style={{
                borderColor: off ? "var(--line)" : "var(--line-bright)",
                color: off ? "var(--faint)" : "var(--dim)",
                opacity: off ? 0.45 : 1,
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: TYPE_COLOR[t] ?? "var(--faint)" }}
              />
              {t}
            </button>
          );
        })}
        {focus && (
          <button
            onClick={() => setFocus(null)}
            className="mono ml-auto rounded border px-2 py-1"
            style={{ borderColor: "var(--signal)", color: "var(--signal)" }}
          >
            clear focus
          </button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="panel overflow-hidden" style={{ background: "var(--panel)" }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full touch-none select-none"
            style={{ display: "block" }}
            role="img"
            aria-label="Knowledge graph of skills, projects and decisions"
          >
            {edges.map((e, i) => {
              const a = byId.get(e.source);
              const b = byId.get(e.target);
              if (!a || !b) return null;
              if (!visible.has(a.id) || !visible.has(b.id)) return null;
              const lit =
                !highlighted || (highlighted.has(a.id) && highlighted.has(b.id));
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={lit ? "var(--line-bright)" : "var(--line)"}
                  strokeWidth={lit ? 1 : 0.5}
                  opacity={lit ? 0.85 : 0.18}
                />
              );
            })}

            {sim.map((n) => {
              if (!visible.has(n.id)) return null;
              const lit = !highlighted || highlighted.has(n.id);
              const r = Math.min(4 + n.weight * 0.85, 16);
              const color = TYPE_COLOR[n.type] ?? "var(--faint)";
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x} ${n.y})`}
                  opacity={lit ? 1 : 0.16}
                  style={{ cursor: "pointer" }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    const { x, y } = toSvg(e.clientX, e.clientY);
                    dragRef.current = { id: n.id, dx: x - n.x, dy: y - n.y };
                  }}
                  onClick={() => setFocus((f) => (f === n.id ? null : n.id))}
                >
                  <circle
                    r={r}
                    fill={color}
                    fillOpacity={n.type === "tech" ? 0.28 : 0.9}
                    stroke={color}
                    strokeWidth={1.4}
                  />
                  {(n.weight > 1 || n.type !== "tech" || focus === n.id) && (
                    <text
                      x={r + 5}
                      y={3.5}
                      fontSize={n.type === "person" ? 13 : 10.5}
                      fill={focus === n.id ? color : "var(--dim)"}
                      style={{ pointerEvents: "none" }}
                    >
                      {n.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          {focused ? (
            <div className="reveal">
              <span
                className="mono inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5"
                style={{
                  borderColor: "var(--line-bright)",
                  color: TYPE_COLOR[focused.type] ?? "var(--faint)",
                }}
              >
                {focused.type}
              </span>
              <h3 className="mt-3 text-[17px] font-medium leading-tight tracking-tight">
                {focused.label}
              </h3>
              {focused.detail && (
                <p className="mt-2 text-[13.5px]" style={{ color: "var(--dim)" }}>
                  {focused.detail}
                </p>
              )}
              {focused.href && (
                <button
                  onClick={() => router.push(focused.href!)}
                  className="mono mt-4 rounded border px-2.5 py-1"
                  style={{ borderColor: "var(--signal)", color: "var(--signal)" }}
                >
                  open →
                </button>
              )}
              <p className="mono mb-2 mt-6" style={{ color: "var(--faint)" }}>
                {focusedNeighbours.length} connections
              </p>
              <div className="max-h-[18rem] space-y-0.5 overflow-y-auto">
                {focusedNeighbours.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => setFocus(n.id)}
                    className="flex w-full items-center gap-2 py-1 text-left"
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: TYPE_COLOR[n.type] ?? "var(--faint)" }}
                    />
                    <span className="truncate text-[13px]" style={{ color: "var(--dim)" }}>
                      {n.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <p className="mono mb-3" style={{ color: "var(--faint)" }}>
                how to read this
              </p>
              <p className="text-[13.5px]" style={{ color: "var(--dim)" }}>
                Every node is derived from the content files — nothing here is drawn
                by hand. Click a node to isolate its neighbourhood, drag to rearrange,
                use the chips above to hide a whole class of entity.
              </p>
              <p className="mt-3 text-[13.5px]" style={{ color: "var(--dim)" }}>
                The same edges power retrieval on{" "}
                <button
                  onClick={() => router.push("/ask")}
                  className="underline underline-offset-4"
                  style={{ color: "var(--ink)" }}
                >
                  /ask
                </button>
                : a question naming a technology reaches the projects that used it
                even when they share no wording.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
