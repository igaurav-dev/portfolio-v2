"use client";

import { useMemo, useState } from "react";

const KEY_COUNT = 240;
const NODE_NAMES = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot"];

/** FNV-1a — small, deterministic, good enough to show the shape. */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function ringFor(nodes: string[], vnodes: number): { pos: number; node: string }[] {
  return nodes
    .flatMap((n) =>
      Array.from({ length: vnodes }, (_, i) => ({ pos: hash(`${n}#${i}`), node: n })),
    )
    .sort((a, b) => a.pos - b.pos);
}

function assign(ring: { pos: number; node: string }[], keyPos: number): string {
  if (ring.length === 0) return "";
  for (const slot of ring) if (slot.pos >= keyPos) return slot.node;
  return ring[0].node;
}

export function HashRing() {
  const [count, setCount] = useState(3);
  const [vnodes, setVnodes] = useState(1);

  const keys = useMemo(
    () => Array.from({ length: KEY_COUNT }, (_, i) => ({ id: `key-${i}`, pos: hash(`key-${i}`) })),
    [],
  );

  const { current, previous, moved, spread } = useMemo(() => {
    const nodesNow = NODE_NAMES.slice(0, count);
    const nodesBefore = NODE_NAMES.slice(0, Math.max(1, count - 1));
    const ringNow = ringFor(nodesNow, vnodes);
    const ringBefore = ringFor(nodesBefore, vnodes);

    const now = new Map<string, string>();
    const before = new Map<string, string>();
    for (const k of keys) {
      now.set(k.id, assign(ringNow, k.pos));
      before.set(k.id, assign(ringBefore, k.pos));
    }

    const movedKeys = new Set(
      keys.filter((k) => now.get(k.id) !== before.get(k.id)).map((k) => k.id),
    );

    const load = new Map<string, number>();
    for (const n of nodesNow) load.set(n, 0);
    for (const k of keys) load.set(now.get(k.id)!, (load.get(now.get(k.id)!) ?? 0) + 1);

    const counts = [...load.values()];
    const ideal = KEY_COUNT / nodesNow.length;
    const worst = Math.max(...counts) / ideal;

    return {
      current: { ring: ringNow, nodes: nodesNow, assignment: now, load },
      previous: ringBefore,
      moved: movedKeys,
      spread: worst,
    };
  }, [count, vnodes, keys]);

  const R = 108;
  const C = 130;
  const toXY = (pos: number, radius: number) => {
    const a = pos * Math.PI * 2 - Math.PI / 2;
    return { x: C + Math.cos(a) * radius, y: C + Math.sin(a) * radius };
  };

  const COLORS = ["#d8ff3e", "#7dd3fc", "#c4b5fd", "#6ee7b7", "#fbbf24", "#f0abfc"];

  return (
    <div className="grid gap-8 md:grid-cols-[260px_1fr] md:items-start">
      <svg viewBox="0 0 260 260" className="w-full max-w-[260px]" role="img" aria-label="Hash ring">
        <circle cx={C} cy={C} r={R} fill="none" stroke="var(--line-bright)" strokeWidth="1" />
        {keys.map((k) => {
          const p = toXY(k.pos, R);
          const owner = current.assignment.get(k.id)!;
          const idx = current.nodes.indexOf(owner);
          const didMove = moved.has(k.id);
          return (
            <circle
              key={k.id}
              cx={p.x}
              cy={p.y}
              r={didMove ? 3 : 1.7}
              fill={didMove ? "var(--dead)" : COLORS[idx % COLORS.length]}
              opacity={didMove ? 1 : 0.62}
            />
          );
        })}
        {current.ring.map((slot, i) => {
          const inner = toXY(slot.pos, R - 13);
          const outer = toXY(slot.pos, R + 13);
          const idx = current.nodes.indexOf(slot.node);
          return (
            <line
              key={`${slot.node}-${i}`}
              x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
              stroke={COLORS[idx % COLORS.length]}
              strokeWidth="2"
            />
          );
        })}
        <text x={C} y={C - 4} textAnchor="middle" className="num" fontSize="21" fill="var(--ink)">
          {moved.size}
        </text>
        <text x={C} y={C + 12} textAnchor="middle" fontSize="8.5" fill="var(--faint)" letterSpacing="1">
          KEYS MOVED
        </text>
      </svg>

      <div>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="mono flex justify-between" style={{ color: "var(--faint)" }}>
              <span>nodes</span>
              <span className="num" style={{ color: "var(--ink)" }}>{count}</span>
            </span>
            <input type="range" min={1} max={6} value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="mt-2 w-full accent-[var(--signal)]" />
          </label>
          <label className="block">
            <span className="mono flex justify-between" style={{ color: "var(--faint)" }}>
              <span>virtual nodes each</span>
              <span className="num" style={{ color: "var(--ink)" }}>{vnodes}</span>
            </span>
            <input type="range" min={1} max={80} value={vnodes}
              onChange={(e) => setVnodes(Number(e.target.value))}
              className="mt-2 w-full accent-[var(--signal)]" />
          </label>
        </div>

        <div className="mt-6 space-y-1.5">
          {current.nodes.map((n, i) => {
            const load = current.load.get(n) ?? 0;
            return (
              <div key={n} className="flex items-center gap-3">
                <span className="mono w-16 shrink-0" style={{ color: COLORS[i % COLORS.length] }}>{n}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "var(--raised)" }}>
                  <div className="h-full rounded-full" style={{ width: `${(load / KEY_COUNT) * 100 * current.nodes.length}%`, maxWidth: "100%", background: COLORS[i % COLORS.length] }} />
                </div>
                <span className="num w-10 shrink-0 text-right text-[12px]" style={{ color: "var(--dim)" }}>{load}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-6 grid grid-cols-3 gap-5">
          <div>
            <p className="num text-[20px]" style={{ color: "var(--dead)" }}>
              {((moved.size / KEY_COUNT) * 100).toFixed(1)}%
            </p>
            <p className="mono mt-1" style={{ color: "var(--faint)" }}>keys remapped</p>
          </div>
          <div>
            <p className="num text-[20px]">{(100 / count).toFixed(1)}%</p>
            <p className="mono mt-1" style={{ color: "var(--faint)" }}>theoretical min</p>
          </div>
          <div>
            <p className="num text-[20px]" style={{ color: spread > 1.4 ? "var(--dead)" : "var(--signal)" }}>
              {spread.toFixed(2)}×
            </p>
            <p className="mono mt-1" style={{ color: "var(--faint)" }}>worst node vs fair share</p>
          </div>
        </div>

        <p className="prose-body mt-6 text-[14.5px]">
          Red keys are the ones that changed owner when you added the newest node.
          With modulo hashing that number would be close to 100% every time. Here it
          hovers near 1/n — which is the entire point.
        </p>
        <p className="prose-body mt-3 text-[14.5px]">
          {vnodes < 8
            ? "Now drag virtual nodes upward. At one point per node the ring is lumpy and load skews badly; the imbalance figure on the right is how much extra traffic the unluckiest node absorbs."
            : `With ${vnodes} virtual nodes per physical node the ring is dense enough that the arcs even out, and the worst node now carries ${spread.toFixed(2)}× its fair share. This is why real implementations use hundreds.`}
        </p>
        <p className="mono mt-4" style={{ color: "var(--faint)" }}>
          ring positions: {previous.length} → {current.ring.length} slots
        </p>
      </div>
    </div>
  );
}
