"use client";

import { useEffect, useRef, useState } from "react";

type Strategy = "block" | "drop-new" | "drop-oldest";

const CAPACITY = 40;
const TICK_MS = 100;

const EXPLAIN: Record<Strategy, string> = {
  block:
    "The producer waits. Nothing is lost, but the pressure travels backwards — whoever is calling the producer now waits too, all the way to the user.",
  "drop-new":
    "Newest arrivals are refused once the buffer is full. Latency for what survives stays flat; you are choosing to lose the most recent data.",
  "drop-oldest":
    "The queue evicts its head to make room. Freshness is preserved and history is lost — correct for metrics, catastrophic for payments.",
};

export function Backpressure() {
  const [produce, setProduce] = useState(120);
  const [consume, setConsume] = useState(60);
  const [strategy, setStrategy] = useState<Strategy>("drop-oldest");
  const [queue, setQueue] = useState(0);
  const [dropped, setDropped] = useState(0);
  const [blockedMs, setBlockedMs] = useState(0);
  const [running, setRunning] = useState(true);
  const carry = useRef({ p: 0, c: 0 });

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const perTick = TICK_MS / 1000;
      carry.current.p += produce * perTick;
      carry.current.c += consume * perTick;
      const incoming = Math.floor(carry.current.p);
      const capacityOut = Math.floor(carry.current.c);
      carry.current.p -= incoming;
      carry.current.c -= capacityOut;

      setQueue((q) => {
        let next = Math.max(0, q - capacityOut);
        const room = CAPACITY - next;

        if (incoming <= room) return next + incoming;

        const excess = incoming - room;
        if (strategy === "block") {
          setBlockedMs((b) => b + (excess / Math.max(produce, 1)) * 1000);
          next = CAPACITY;
        } else {
          setDropped((d) => d + excess);
          next = CAPACITY;
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [produce, consume, strategy, running]);

  const reset = () => {
    setQueue(0);
    setDropped(0);
    setBlockedMs(0);
    carry.current = { p: 0, c: 0 };
  };

  const saturated = queue >= CAPACITY;
  // Little's Law: latency = queue depth / service rate
  const latency = consume > 0 ? (queue / consume) * 1000 : Infinity;

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="mono flex justify-between" style={{ color: "var(--faint)" }}>
            <span>producer</span>
            <span className="num" style={{ color: "var(--ink)" }}>{produce}/s</span>
          </span>
          <input
            type="range" min={0} max={300} value={produce}
            onChange={(e) => setProduce(Number(e.target.value))}
            className="mt-2 w-full accent-[var(--signal)]"
          />
        </label>
        <label className="block">
          <span className="mono flex justify-between" style={{ color: "var(--faint)" }}>
            <span>consumer</span>
            <span className="num" style={{ color: "var(--ink)" }}>{consume}/s</span>
          </span>
          <input
            type="range" min={0} max={300} value={consume}
            onChange={(e) => setConsume(Number(e.target.value))}
            className="mt-2 w-full accent-[var(--signal)]"
          />
        </label>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {(["block", "drop-new", "drop-oldest"] as Strategy[]).map((s) => (
          <button
            key={s}
            onClick={() => { setStrategy(s); reset(); }}
            className="mono rounded border px-2.5 py-1 transition-colors"
            style={{
              borderColor: strategy === s ? "var(--signal)" : "var(--line-bright)",
              color: strategy === s ? "var(--signal)" : "var(--dim)",
            }}
          >
            {s}
          </button>
        ))}
        <button onClick={() => setRunning((r) => !r)} className="mono ml-auto rounded border px-2.5 py-1" style={{ borderColor: "var(--line-bright)", color: "var(--dim)" }}>
          {running ? "pause" : "run"}
        </button>
        <button onClick={reset} className="mono rounded border px-2.5 py-1" style={{ borderColor: "var(--line-bright)", color: "var(--dim)" }}>
          reset
        </button>
      </div>

      <div className="mt-6 flex gap-[3px]" aria-hidden>
        {Array.from({ length: CAPACITY }, (_, i) => (
          <div
            key={i}
            className="h-9 flex-1 rounded-[2px] transition-colors duration-150"
            style={{
              background:
                i < queue
                  ? saturated && i > CAPACITY - 6
                    ? "var(--dead)"
                    : "var(--signal)"
                  : "var(--raised)",
            }}
          />
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-4">
        <div>
          <p className="num text-[20px]">{queue}<span className="mono" style={{ color: "var(--faint)" }}>/{CAPACITY}</span></p>
          <p className="mono mt-1" style={{ color: "var(--faint)" }}>queue depth</p>
        </div>
        <div>
          <p className="num text-[20px]" style={{ color: latency > 400 ? "var(--dead)" : "var(--ink)" }}>
            {Number.isFinite(latency) ? `${latency.toFixed(0)}ms` : "∞"}
          </p>
          <p className="mono mt-1" style={{ color: "var(--faint)" }}>queueing delay</p>
        </div>
        <div>
          <p className="num text-[20px]" style={{ color: dropped ? "var(--dead)" : "var(--ink)" }}>{dropped}</p>
          <p className="mono mt-1" style={{ color: "var(--faint)" }}>dropped</p>
        </div>
        <div>
          <p className="num text-[20px]" style={{ color: blockedMs ? "var(--dead)" : "var(--ink)" }}>
            {(blockedMs / 1000).toFixed(1)}s
          </p>
          <p className="mono mt-1" style={{ color: "var(--faint)" }}>producer stalled</p>
        </div>
      </div>

      <p className="prose-body mt-6 text-[14.5px]">{EXPLAIN[strategy]}</p>
      <p className="prose-body mt-3 text-[14.5px]">
        {produce > consume
          ? "You are producing faster than you consume. There is no fourth option — the queue is a buffer, not a solution, and it only decides who absorbs the mismatch."
          : "Consumer keeps up, so the queue drains and none of this matters. Every backpressure strategy looks identical until it doesn't."}
      </p>
    </div>
  );
}
