"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CATEGORY_COLOR,
  humanDuration,
  segmentsForDay,
  toClock,
  toMinutes,
  type Block,
  type Routine,
} from "@/lib/routine-core";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CATEGORIES = ["health", "trading", "work", "learning", "building", "rest"] as const;

interface CheckInState {
  date: string;
  backend: string;
  blocks: { id: string; label: string; start: string; end: string; category: string }[];
  entries: { blockId: string; status: string }[];
  health: { ok: boolean; detail: string; latencyMs: number };
}

export function AdminPlanner({
  notify,
}: {
  notify: (kind: "ok" | "err", text: string) => void;
}) {
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewDay, setPreviewDay] = useState(1);
  const [checkins, setCheckins] = useState<CheckInState | null>(null);

  const load = useCallback(async () => {
    const [r, c] = await Promise.all([
      fetch("/api/admin/routine", { cache: "no-store" }),
      fetch("/api/admin/checkin", { cache: "no-store" }),
    ]);
    if (r.ok) setRoutine((await r.json()).routine);
    if (c.ok) setCheckins(await c.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const segments = useMemo(
    () => (routine ? segmentsForDay(routine, previewDay) : []),
    [routine, previewDay],
  );
  const free = segments.filter((s) => s.category === "free");
  const freeMinutes = free.reduce((n, s) => n + s.minutes, 0);

  const update = (index: number, patch: Partial<Block>) => {
    setRoutine((r) =>
      r ? { ...r, blocks: r.blocks.map((b, i) => (i === index ? { ...b, ...patch } : b)) } : r,
    );
  };

  const save = async () => {
    if (!routine) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/routine", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(routine),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.hint ? `${data.error} — ${data.hint}` : data.error);
      notify("ok", `saved ${data.blocks} blocks — /day is live with the change`);
      await load();
    } catch (err) {
      notify("err", err instanceof Error ? err.message : "save failed");
    } finally {
      setBusy(false);
    }
  };

  const mark = async (blockId: string, status: string) => {
    if (!checkins) return;
    const existing = checkins.entries.find((e) => e.blockId === blockId);
    try {
      if (existing?.status === status) {
        await fetch(`/api/admin/checkin?date=${checkins.date}&blockId=${blockId}`, {
          method: "DELETE",
        });
      } else {
        const res = await fetch("/api/admin/checkin", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ date: checkins.date, blockId, status }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
      }
      await load();
    } catch (err) {
      notify("err", err instanceof Error ? err.message : "check-in failed");
    }
  };

  if (!routine) return <p className="mono" style={{ color: "var(--faint)" }}>loading…</p>;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_20rem] lg:items-start">
      <div>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <p className="mono" style={{ color: "var(--faint)" }}>
            {routine.blocks.length} blocks · {routine.timezone}
          </p>
          <button
            onClick={() =>
              setRoutine((r) =>
                r
                  ? {
                      ...r,
                      blocks: [
                        ...r.blocks,
                        {
                          id: `block-${Date.now().toString(36)}`,
                          label: "New block",
                          start: "09:00",
                          end: "10:00",
                          category: "learning",
                          days: [1, 2, 3, 4, 5],
                          note: "",
                        },
                      ],
                    }
                  : r,
              )
            }
            className="mono rounded border px-2.5 py-1"
            style={{ borderColor: "var(--line-bright)", color: "var(--dim)" }}
          >
            + add block
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="mono ml-auto rounded border px-3 py-1.5 disabled:opacity-40"
            style={{ borderColor: "var(--signal)", color: "var(--signal)" }}
          >
            {busy ? "saving…" : "save routine"}
          </button>
        </div>

        <div className="space-y-px">
          {routine.blocks.map((b, i) => (
            <div
              key={b.id}
              className="grid gap-2 border-b py-3"
              style={{ borderColor: "var(--line)" }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: CATEGORY_COLOR[b.category] }}
                />
                <input
                  value={b.label}
                  onChange={(e) => update(i, { label: e.target.value })}
                  className="min-w-[10rem] flex-1 bg-transparent text-[14px] outline-none"
                  style={{ color: "var(--ink)" }}
                />
                <input
                  type="time"
                  value={b.start}
                  onChange={(e) => update(i, { start: e.target.value })}
                  className="num rounded border bg-transparent px-1.5 py-0.5 text-[12px] outline-none"
                  style={{ borderColor: "var(--line-bright)", color: "var(--ink)" }}
                />
                <span style={{ color: "var(--faint)" }}>–</span>
                <input
                  type="time"
                  value={b.end === "24:00" ? "23:59" : b.end}
                  onChange={(e) => update(i, { end: e.target.value })}
                  className="num rounded border bg-transparent px-1.5 py-0.5 text-[12px] outline-none"
                  style={{ borderColor: "var(--line-bright)", color: "var(--ink)" }}
                />
                <select
                  value={b.category}
                  onChange={(e) => update(i, { category: e.target.value as Block["category"] })}
                  className="mono rounded border bg-transparent px-1.5 py-1 outline-none"
                  style={{ borderColor: "var(--line-bright)", color: "var(--dim)" }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c} style={{ background: "var(--panel)" }}>
                      {c}
                    </option>
                  ))}
                </select>
                <span className="num" style={{ color: "var(--faint)", fontSize: 11 }}>
                  {humanDuration(
                    (b.end === "24:00" ? 1440 : toMinutes(b.end)) - toMinutes(b.start) > 0
                      ? (b.end === "24:00" ? 1440 : toMinutes(b.end)) - toMinutes(b.start)
                      : 1440 - toMinutes(b.start) + toMinutes(b.end),
                  )}
                </span>
                <button
                  onClick={() =>
                    setRoutine((r) =>
                      r ? { ...r, blocks: r.blocks.filter((_, j) => j !== i) } : r,
                    )
                  }
                  className="mono rounded border px-1.5 py-0.5"
                  style={{ borderColor: "var(--line)", color: "var(--dead)" }}
                >
                  del
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1">
                {DAYS.map((d, di) => {
                  const on = b.days.includes(di);
                  return (
                    <button
                      key={d}
                      onClick={() =>
                        update(i, {
                          days: on ? b.days.filter((x) => x !== di) : [...b.days, di].sort(),
                        })
                      }
                      className="mono rounded border px-1.5 py-0.5"
                      style={{
                        borderColor: on ? "var(--signal)" : "var(--line)",
                        color: on ? "var(--signal)" : "var(--faint)",
                      }}
                    >
                      {d[0]}
                    </button>
                  );
                })}
                <input
                  value={b.note}
                  onChange={(e) => update(i, { note: e.target.value })}
                  placeholder="note shown on the dial…"
                  className="ml-2 min-w-[12rem] flex-1 bg-transparent text-[12.5px] outline-none"
                  style={{ color: "var(--faint)" }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <aside className="space-y-8">
        <div>
          <p className="mono mb-3" style={{ color: "var(--faint)" }}>
            free time preview
          </p>
          <div className="mb-3 flex flex-wrap gap-1">
            {DAYS.map((d, i) => (
              <button
                key={d}
                onClick={() => setPreviewDay(i)}
                className="mono rounded border px-1.5 py-0.5"
                style={{
                  borderColor: i === previewDay ? "var(--signal)" : "var(--line)",
                  color: i === previewDay ? "var(--signal)" : "var(--faint)",
                }}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="flex h-6 w-full overflow-hidden rounded" style={{ background: "var(--raised)" }}>
            {segments.map((s) => (
              <div
                key={`${s.id}-${s.startMin}`}
                style={{
                  width: `${(s.minutes / 1440) * 100}%`,
                  background: s.category === "free" ? "transparent" : CATEGORY_COLOR[s.category],
                  backgroundImage:
                    s.category === "free"
                      ? "repeating-linear-gradient(45deg, var(--line-bright) 0 1px, transparent 1px 5px)"
                      : undefined,
                  borderRight: "1px solid var(--bg)",
                }}
                title={`${s.label} ${toClock(s.startMin)}–${toClock(s.endMin)}`}
              />
            ))}
          </div>
          <p className="mono mt-2" style={{ color: "var(--faint)" }}>
            {humanDuration(freeMinutes)} unclaimed across {free.length} gaps
          </p>
          <div className="mt-2 space-y-0.5">
            {free.map((f) => (
              <p key={f.startMin} className="num" style={{ color: "var(--faint)", fontSize: 11.5 }}>
                {toClock(f.startMin)}–{toClock(f.endMin)} · {humanDuration(f.minutes)}
              </p>
            ))}
          </div>
        </div>

        {checkins && (
          <div>
            <p className="mono mb-1" style={{ color: "var(--faint)" }}>
              check in · {checkins.date}
            </p>
            <p className="mono mb-3" style={{ color: checkins.health.ok ? "var(--signal)" : "var(--dead)" }}>
              {checkins.backend} · {checkins.health.detail}
            </p>
            <div className="space-y-1.5">
              {checkins.blocks.map((b) => {
                const entry = checkins.entries.find((e) => e.blockId === b.id);
                return (
                  <div key={b.id} className="flex items-center gap-2">
                    <span className="flex-1 truncate text-[12.5px]" style={{ color: "var(--dim)" }}>
                      {b.label}
                    </span>
                    {(["done", "partial", "skipped"] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => mark(b.id, status)}
                        className="mono rounded border px-1.5 py-0.5"
                        style={{
                          borderColor:
                            entry?.status === status ? "var(--signal)" : "var(--line)",
                          color:
                            entry?.status === status
                              ? status === "skipped"
                                ? "var(--dead)"
                                : "var(--signal)"
                              : "var(--faint)",
                        }}
                      >
                        {status[0].toUpperCase()}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
            <p className="mono mt-3" style={{ color: "var(--faint)" }}>
              D done · P partial · S skipped · click again to clear
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
