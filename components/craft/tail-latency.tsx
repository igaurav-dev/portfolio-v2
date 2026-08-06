"use client";

import { useMemo, useState } from "react";

const TRIALS = 4000;

/** Lognormal-ish service time: mostly fast, occasionally awful. */
function sample(medianMs: number, sigma: number, rng: () => number): number {
  const u = Math.max(rng(), 1e-9);
  const v = Math.max(rng(), 1e-9);
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return medianMs * Math.exp(sigma * z);
}

function mulberry(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function TailLatency() {
  const [fanout, setFanout] = useState(1);
  const [sigma, setSigma] = useState(0.9);

  const stats = useMemo(() => {
    const rng = mulberry(12345);
    const single: number[] = [];
    const combined: number[] = [];

    for (let t = 0; t < TRIALS; t++) {
      let worst = 0;
      for (let i = 0; i < fanout; i++) {
        const s = sample(20, sigma, rng);
        if (i === 0) single.push(s);
        if (s > worst) worst = s;
      }
      combined.push(worst);
    }
    single.sort((a, b) => a - b);
    combined.sort((a, b) => a - b);

    return {
      singleP50: quantile(single, 0.5),
      singleP99: quantile(single, 0.99),
      p50: quantile(combined, 0.5),
      p95: quantile(combined, 0.95),
      p99: quantile(combined, 0.99),
      slowShare:
        combined.filter((v) => v > quantile(single, 0.99)).length / combined.length,
      histogram: combined,
    };
  }, [fanout, sigma]);

  const bins = useMemo(() => {
    const BUCKETS = 44;
    const top = quantile(stats.histogram, 0.995);
    const out = new Array(BUCKETS).fill(0);
    for (const v of stats.histogram) {
      const i = Math.min(BUCKETS - 1, Math.floor((v / top) * BUCKETS));
      out[i]++;
    }
    const peak = Math.max(...out, 1);
    return { out, peak, top };
  }, [stats]);

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="mono flex justify-between" style={{ color: "var(--faint)" }}>
            <span>backends per request</span>
            <span className="num" style={{ color: "var(--ink)" }}>{fanout}</span>
          </span>
          <input type="range" min={1} max={100} value={fanout}
            onChange={(e) => setFanout(Number(e.target.value))}
            className="mt-2 w-full accent-[var(--signal)]" />
        </label>
        <label className="block">
          <span className="mono flex justify-between" style={{ color: "var(--faint)" }}>
            <span>service-time variance (σ)</span>
            <span className="num" style={{ color: "var(--ink)" }}>{sigma.toFixed(2)}</span>
          </span>
          <input type="range" min={20} max={160} value={sigma * 100}
            onChange={(e) => setSigma(Number(e.target.value) / 100)}
            className="mt-2 w-full accent-[var(--signal)]" />
        </label>
      </div>

      <div className="mt-7 flex h-32 items-end gap-[2px]">
        {bins.out.map((n, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-[2px] transition-all duration-300"
            style={{
              height: `${(n / bins.peak) * 100}%`,
              background: i / bins.out.length > 0.7 ? "var(--dead)" : "var(--signal)",
              opacity: 0.42 + (n / bins.peak) * 0.58,
            }}
            title={`${((i / bins.out.length) * bins.top).toFixed(0)}–${(((i + 1) / bins.out.length) * bins.top).toFixed(0)}ms: ${n}`}
          />
        ))}
      </div>
      <div className="mono mt-1.5 flex justify-between" style={{ color: "var(--faint)" }}>
        <span>0ms</span>
        <span>observed request latency ({TRIALS.toLocaleString()} simulated)</span>
        <span>{bins.top.toFixed(0)}ms</span>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-5 sm:grid-cols-4">
        <div>
          <p className="num text-[20px]">{stats.p50.toFixed(1)}ms</p>
          <p className="mono mt-1" style={{ color: "var(--faint)" }}>p50</p>
        </div>
        <div>
          <p className="num text-[20px]">{stats.p95.toFixed(1)}ms</p>
          <p className="mono mt-1" style={{ color: "var(--faint)" }}>p95</p>
        </div>
        <div>
          <p className="num text-[20px]" style={{ color: "var(--dead)" }}>{stats.p99.toFixed(1)}ms</p>
          <p className="mono mt-1" style={{ color: "var(--faint)" }}>p99</p>
        </div>
        <div>
          <p className="num text-[20px]" style={{ color: "var(--dead)" }}>
            {(stats.slowShare * 100).toFixed(1)}%
          </p>
          <p className="mono mt-1" style={{ color: "var(--faint)" }}>
            requests past one backend&rsquo;s p99
          </p>
        </div>
      </div>

      <p className="prose-body mt-7 text-[14.5px]">
        A single backend has a p50 of {stats.singleP50.toFixed(1)}ms and a p99 of{" "}
        {stats.singleP99.toFixed(1)}ms. Fan a request out to {fanout} of them and wait
        for all to return, and{" "}
        <strong>{(stats.slowShare * 100).toFixed(1)}%</strong> of your requests are now
        slower than the p99 of any individual one — because you only need a single
        unlucky backend to ruin the whole request.
      </p>
      <p className="prose-body mt-3 text-[14.5px]">
        {fanout === 1
          ? "Drag the fanout up. Watch the median barely move while the distribution grows a tail."
          : "The median is a comfortable lie here. Nothing about the individual services got worse — the architecture did the damage. This is the argument for hedged requests, and for treating p99 as the number your SLO is written against."}
      </p>
    </div>
  );
}
