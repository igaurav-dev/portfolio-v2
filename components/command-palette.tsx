"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export interface Command {
  id: string;
  label: string;
  group: string;
  hint?: string;
  href?: string;
  action?: "theme" | "trace" | "copy-email" | "print" | "terminal";
  payload?: string;
}

/** Subsequence match, ranked by how tightly the query packs into the label. */
function fuzzy(query: string, label: string): number | null {
  if (!query) return 0;
  const q = query.toLowerCase();
  const l = label.toLowerCase();
  let qi = 0;
  let score = 0;
  let last = -1;
  for (let i = 0; i < l.length && qi < q.length; i++) {
    if (l[i] === q[qi]) {
      score += last === i - 1 ? 3 : 1;
      if (i === 0 || l[i - 1] === " " || l[i - 1] === "/") score += 2;
      last = i;
      qi++;
    }
  }
  return qi === q.length ? score : null;
}

export function CommandPalette({ commands }: { commands: Command[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chord = useRef<string | null>(null);

  const results = useMemo(() => {
    const scored = commands
      .map((c) => ({ c, s: fuzzy(query, `${c.label} ${c.group}`) }))
      .filter((r): r is { c: Command; s: number } => r.s !== null)
      .sort((a, b) => b.s - a.s);
    return scored.slice(0, 40).map((r) => r.c);
  }, [commands, query]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
        setHelp(false);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "?") {
        e.preventDefault();
        setHelp((v) => !v);
        return;
      }
      if (e.key === "g") {
        chord.current = "g";
        setTimeout(() => (chord.current = null), 1200);
        return;
      }
      if (chord.current === "g") {
        const map: Record<string, string> = {
          h: "/",
          w: "/work",
          c: "/craft",
          s: "/status",
          a: "/ask",
          d: "/decisions",
          g: "/graph",
          y: "/day",
          p: "/proof",
          r: "/resume",
          b: "/about",
        };
        const dest = map[e.key];
        if (dest) {
          e.preventDefault();
          chord.current = null;
          router.push(dest);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
    else setQuery("");
  }, [open]);

  const run = (cmd: Command) => {
    setOpen(false);
    if (cmd.href) {
      router.push(cmd.href);
      return;
    }
    switch (cmd.action) {
      case "theme": {
        const next =
          document.documentElement.getAttribute("data-theme") === "light"
            ? "dark"
            : "light";
        document.documentElement.setAttribute("data-theme", next);
        try {
          localStorage.setItem("theme", next);
        } catch {
          /* ignore */
        }
        break;
      }
      case "trace":
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "t" }));
        break;
      case "terminal":
        window.dispatchEvent(new Event("terminal:open"));
        break;
      case "copy-email":
        void navigator.clipboard.writeText(cmd.payload ?? "");
        setToast("email copied");
        setTimeout(() => setToast(null), 1800);
        break;
      case "print":
        window.print();
        break;
    }
  };

  const grouped = results.reduce<Record<string, Command[]>>((acc, c) => {
    (acc[c.group] ??= []).push(c);
    return acc;
  }, {});

  return (
    <>
      {toast && (
        <div
          className="no-print fixed bottom-14 left-1/2 z-50 -translate-x-1/2 rounded-full border px-3 py-1.5 reveal"
          style={{ background: "var(--panel)", borderColor: "var(--line-bright)" }}
        >
          <span className="mono" style={{ color: "var(--signal)" }}>
            {toast}
          </span>
        </div>
      )}

      {help && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "color-mix(in srgb, var(--bg) 72%, transparent)" }}
          onClick={() => setHelp(false)}
        >
          <div className="panel reveal w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <p className="mono mb-4" style={{ color: "var(--faint)" }}>
              keyboard
            </p>
            <dl className="space-y-2">
              {[
                ["⌘K", "command palette"],
                ["`", "open the terminal"],
                ["T", "open the request trace"],
                ["G then H", "home"],
                ["G then W", "work"],
                ["G then C", "craft"],
                ["G then D", "decisions"],
                ["G then G", "knowledge graph"],
                ["G then Y", "the day"],
                ["G then P", "receipts"],
                ["G then S", "status"],
                ["G then A", "ask"],
                ["G then R", "résumé"],
                ["?", "this list"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4">
                  <dd className="text-[13px]" style={{ color: "var(--dim)" }}>
                    {v}
                  </dd>
                  <dt
                    className="mono shrink-0 rounded border px-1.5 py-0.5"
                    style={{ borderColor: "var(--line-bright)", color: "var(--ink)" }}
                  >
                    {k}
                  </dt>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}

      {open && (
        <div
          className="no-print fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]"
          style={{ background: "color-mix(in srgb, var(--bg) 72%, transparent)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="panel reveal w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Command palette"
          >
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((i) => Math.min(i + 1, results.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter" && results[active]) {
                  e.preventDefault();
                  run(results[active]);
                }
              }}
              placeholder="Jump to, or ask…"
              className="w-full border-b bg-transparent px-4 py-3.5 text-[15px] outline-none"
              style={{ borderColor: "var(--line)", color: "var(--ink)" }}
            />
            <div className="max-h-[46vh] overflow-y-auto py-1.5">
              {results.length === 0 && (
                <p className="mono px-4 py-6 text-center" style={{ color: "var(--faint)" }}>
                  nothing matches — try &ldquo;decisions&rdquo; or &ldquo;qdrant&rdquo;
                </p>
              )}
              {Object.entries(grouped).map(([group, items]) => (
                <div key={group} className="mb-1">
                  <p className="mono px-4 py-1.5" style={{ color: "var(--faint)" }}>
                    {group}
                  </p>
                  {items.map((c) => {
                    const index = results.indexOf(c);
                    const isActive = index === active;
                    return (
                      <button
                        key={c.id}
                        onMouseEnter={() => setActive(index)}
                        onClick={() => run(c)}
                        className="flex w-full items-center gap-3 px-4 py-2 text-left"
                        style={{ background: isActive ? "var(--raised)" : "transparent" }}
                      >
                        <span
                          className="h-1 w-1 shrink-0 rounded-full"
                          style={{ background: isActive ? "var(--signal)" : "transparent" }}
                        />
                        <span className="truncate text-[13.5px]" style={{ color: "var(--ink)" }}>
                          {c.label}
                        </span>
                        {c.hint && (
                          <span className="mono ml-auto shrink-0" style={{ color: "var(--faint)" }}>
                            {c.hint}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
