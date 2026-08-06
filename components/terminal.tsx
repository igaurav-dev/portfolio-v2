"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export interface TerminalProject {
  slug: string;
  name: string;
  client: string;
  year: string;
  status: string;
  tagline: string;
  stack: string[];
  metrics: { label: string; value: string }[];
}

export interface TerminalPayload {
  name: string;
  role: string;
  location: string;
  email: string;
  website: string;
  years: string;
  availability: string;
  projects: TerminalProject[];
  decisions: { id: string; title: string; project: string }[];
  skills: Record<string, string[]>;
  routes: { path: string; label: string }[];
}

type LineKind = "in" | "out" | "dim" | "ok" | "err" | "head";

interface Line {
  kind: LineKind;
  text: string;
  href?: string;
}

const COLOR: Record<LineKind, string> = {
  in: "var(--ink)",
  out: "var(--dim)",
  dim: "var(--faint)",
  ok: "var(--signal)",
  err: "var(--dead)",
  head: "var(--ink)",
};

const BANNER = String.raw`
   ▄▄▄  ▄  ▄ ▄▄▄▄  ▄▄▄▄  ▄  ▄  ▄  ▄
  ▄▀ ▀▄ ▄▄▄▄ ▄  ▄  ▄▄▄▀  ▄▄▄▀  ▄▄▄▄
  ▀▄▄▄▀ ▄  ▄ ▀▄▄▀  ▄  ▀  ▄  ▀   ▄▄
`;

const COMMANDS = [
  ["help", "this list"],
  ["whoami", "who is behind this site"],
  ["neofetch", "the system card"],
  ["ls [work|decisions|skills|routes]", "list things"],
  ["cat <project>", "print a project in full"],
  ["open <path|project>", "navigate there"],
  ["grep <term>", "search everything"],
  ["ask <question>", "run the retrieval console inline"],
  ["graph <entity>", "what connects to what"],
  ["trace", "spans for the current page"],
  ["stats", "live server telemetry"],
  ["gh", "what the commit log says"],
  ["day", "what he is doing right now"],
  ["streak", "routine consistency"],
  ["contact", "how to reach him"],
  ["theme [dark|light]", "switch appearance"],
  ["history", "commands this session"],
  ["clear", "wipe the scrollback"],
  ["exit", "close the terminal"],
] as const;

export function Terminal({ data }: { data: TerminalPayload }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [cursor, setCursor] = useState(-1);
  const [lines, setLines] = useState<Line[]>([
    { kind: "ok", text: BANNER },
    { kind: "dim", text: `${data.name} — ${data.role}` },
    { kind: "dim", text: "type `help` for commands, `ask <question>` to query the corpus, Esc to close" },
  ]);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const push = useCallback((...next: Line[]) => {
    setLines((prev) => [...prev, ...next]);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lines, busy]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;

      if (e.key === "`" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("terminal:open", () => setOpen(true));
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const findProject = (needle: string) =>
    data.projects.find(
      (p) =>
        p.slug === needle ||
        p.slug.startsWith(needle) ||
        p.name.toLowerCase().replace(/[^a-z0-9]/g, "") ===
          needle.toLowerCase().replace(/[^a-z0-9]/g, ""),
    );

  const run = async (raw: string) => {
    const input = raw.trim();
    if (!input) return;

    push({ kind: "in", text: input });
    setHistory((h) => [input, ...h].slice(0, 60));
    setCursor(-1);

    const [cmd, ...rest] = input.split(/\s+/);
    const arg = rest.join(" ");
    const command = cmd.toLowerCase();

    switch (command) {
      case "help":
        push({ kind: "head", text: "commands" });
        COMMANDS.forEach(([name, desc]) =>
          push({ kind: "out", text: `  ${name.padEnd(34)} ${desc}` }),
        );
        break;

      case "whoami":
        push(
          { kind: "ok", text: data.name },
          { kind: "out", text: `${data.role}` },
          { kind: "out", text: `${data.location} · ${data.years} years · ${data.availability}` },
          { kind: "dim", text: `${data.email} · ${data.website}` },
        );
        break;

      case "neofetch": {
        const techCount = new Set(Object.values(data.skills).flat()).size;
        const rows = [
          ["role", data.role],
          ["location", data.location],
          ["experience", `${data.years} years`],
          ["projects", `${data.projects.length} documented`],
          ["decisions", `${data.decisions.length} recorded with alternatives`],
          ["technologies", `${techCount} across ${Object.keys(data.skills).length} areas`],
          ["stack here", "Next.js · TypeScript · zero web fonts"],
          ["status", data.availability],
        ];
        push({ kind: "ok", text: BANNER });
        rows.forEach(([k, v]) =>
          push({ kind: "out", text: `  ${String(k).padEnd(14)} ${v}` }),
        );
        break;
      }

      case "ls": {
        const target = (arg || "routes").toLowerCase();
        if (target.startsWith("work") || target.startsWith("proj")) {
          push({ kind: "head", text: `${data.projects.length} projects` });
          data.projects.forEach((p) =>
            push({
              kind: "out",
              text: `  ${p.slug.padEnd(20)} ${p.year}  ${p.client.padEnd(24)} ${p.tagline.slice(0, 56)}`,
              href: `/work/${p.slug}`,
            }),
          );
        } else if (target.startsWith("dec")) {
          push({ kind: "head", text: `${data.decisions.length} decisions` });
          data.decisions.forEach((d) =>
            push({ kind: "out", text: `  ${d.id.padEnd(26)} ${d.title}`, href: `/decisions#${d.id}` }),
          );
        } else if (target.startsWith("skill")) {
          Object.entries(data.skills).forEach(([cat, list]) => {
            push({ kind: "head", text: cat });
            push({ kind: "out", text: `  ${list.join(", ")}` });
          });
        } else {
          push({ kind: "head", text: "routes" });
          data.routes.forEach((r) =>
            push({ kind: "out", text: `  ${r.path.padEnd(14)} ${r.label}`, href: r.path }),
          );
          push({ kind: "dim", text: "  try: ls work · ls decisions · ls skills" });
        }
        break;
      }

      case "cat": {
        const project = findProject(arg);
        if (!project) {
          push({ kind: "err", text: `cat: ${arg || "(nothing)"}: no such project. try \`ls work\`` });
          break;
        }
        push(
          { kind: "ok", text: project.name },
          { kind: "out", text: project.tagline },
          { kind: "dim", text: `${project.client} · ${project.year} · ${project.status}` },
          { kind: "dim", text: `stack: ${project.stack.join(", ")}` },
        );
        project.metrics.forEach((m) =>
          push({ kind: "out", text: `  ${m.label.padEnd(28)} ${m.value}` }),
        );
        push({ kind: "dim", text: `full case study → /work/${project.slug}`, href: `/work/${project.slug}` });
        break;
      }

      case "open":
      case "cd": {
        const project = findProject(arg);
        const path = project
          ? `/work/${project.slug}`
          : arg.startsWith("/")
            ? arg
            : `/${arg}`;
        push({ kind: "ok", text: `→ ${path}` });
        setOpen(false);
        router.push(path);
        break;
      }

      case "grep": {
        if (!arg) {
          push({ kind: "err", text: "grep: give me something to look for" });
          break;
        }
        const needle = arg.toLowerCase();
        const hits: Line[] = [];
        data.projects.forEach((p) => {
          const haystack = `${p.name} ${p.tagline} ${p.stack.join(" ")} ${p.client}`.toLowerCase();
          if (haystack.includes(needle))
            hits.push({ kind: "out", text: `  work/${p.slug.padEnd(20)} ${p.tagline.slice(0, 60)}`, href: `/work/${p.slug}` });
        });
        data.decisions.forEach((d) => {
          if (d.title.toLowerCase().includes(needle))
            hits.push({ kind: "out", text: `  decisions/${d.id.padEnd(20)} ${d.title}`, href: `/decisions#${d.id}` });
        });
        Object.entries(data.skills).forEach(([cat, list]) => {
          const found = list.filter((s) => s.toLowerCase().includes(needle));
          if (found.length)
            hits.push({ kind: "out", text: `  skills/${cat.padEnd(18)} ${found.join(", ")}` });
        });
        if (hits.length === 0) push({ kind: "err", text: `grep: no match for "${arg}"` });
        else {
          push({ kind: "head", text: `${hits.length} matches` });
          hits.forEach((h) => push(h));
        }
        break;
      }

      case "ask": {
        if (!arg) {
          push({ kind: "err", text: "ask: what do you want to know?" });
          break;
        }
        setBusy(true);
        try {
          const res = await fetch("/api/ask", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ question: arg }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "failed");
          push({ kind: "out", text: json.answer });
          push({
            kind: "dim",
            text: `[${json.mode}] retrieval ${json.timings.retrieveMs.toFixed(1)}ms · ${json.retrieval.lexical} lexical + ${json.retrieval.expanded} graph-expanded${json.costUsd ? ` · $${json.costUsd.toFixed(5)}` : ""} · ${json.quota.remaining}/${json.quota.capacity} left this hour`,
          });
          json.hits.slice(0, 4).forEach((h: { rank: number; source: string; score: number; via: string; href: string }) =>
            push({ kind: "dim", text: `  [${h.rank}] ${h.score.toFixed(2)} ${h.via.padEnd(6)} ${h.source}`, href: h.href }),
          );
          if (json.warning) push({ kind: "err", text: `  ${json.warning}` });
        } catch (err) {
          push({ kind: "err", text: `ask: ${err instanceof Error ? err.message : "failed"}` });
        }
        setBusy(false);
        break;
      }

      case "graph": {
        if (!arg) {
          push({ kind: "dim", text: "graph: name a technology, project or company. try `graph Qdrant`" });
          push({ kind: "dim", text: "full explorer → /graph", href: "/graph" });
          break;
        }
        const needle = arg.toLowerCase();
        const usedBy = data.projects.filter((p) =>
          p.stack.some((s) => s.toLowerCase().includes(needle)),
        );
        const project = findProject(arg);
        if (project) {
          push({ kind: "head", text: `${project.name} connects to` });
          push({ kind: "out", text: `  company    ${project.client}` });
          push({ kind: "out", text: `  tech       ${project.stack.join(", ")}` });
          const related = data.decisions.filter((d) => d.project === project.slug);
          if (related.length)
            push({ kind: "out", text: `  decisions  ${related.map((d) => d.title).join(" · ")}` });
        } else if (usedBy.length) {
          push({ kind: "head", text: `"${arg}" appears in ${usedBy.length} projects` });
          usedBy.forEach((p) =>
            push({ kind: "out", text: `  ${p.slug.padEnd(20)} ${p.client}`, href: `/work/${p.slug}` }),
          );
        } else {
          push({ kind: "err", text: `graph: "${arg}" is not a node. try \`graph Qdrant\` or open /graph` });
        }
        break;
      }

      case "trace": {
        const nav = performance.getEntriesByType("navigation")[0] as
          | PerformanceNavigationTiming
          | undefined;
        push({ kind: "head", text: "this navigation, measured in your browser" });
        if (nav) {
          push({ kind: "out", text: `  ttfb        ${(nav.responseStart - nav.requestStart).toFixed(1)}ms` });
          push({ kind: "out", text: `  download    ${(nav.responseEnd - nav.responseStart).toFixed(1)}ms` });
          push({ kind: "out", text: `  dom ready   ${(nav.domContentLoadedEventEnd - nav.responseEnd).toFixed(1)}ms` });
          push({ kind: "out", text: `  transfer    ${(nav.transferSize / 1024).toFixed(1)}KB` });
        }
        const fcp = performance.getEntriesByType("paint").find((p) => p.name === "first-contentful-paint");
        if (fcp) push({ kind: "out", text: `  fcp         ${fcp.startTime.toFixed(1)}ms` });
        push({ kind: "dim", text: "server spans live in the strip below — press T" });
        break;
      }

      case "stats": {
        setBusy(true);
        try {
          const res = await fetch("/api/health", { cache: "no-store" });
          const json = await res.json();
          push({ kind: "head", text: `status: ${json.status}` });
          json.checks.forEach((c: { name: string; ok: boolean; ms: number; optional: boolean }) =>
            push({
              kind: c.ok ? "out" : c.optional ? "dim" : "err",
              text: `  ${c.name.padEnd(18)} ${c.ok ? `${c.ms.toFixed(1)}ms` : c.optional ? "not configured" : "down"}`,
            }),
          );
          push({ kind: "dim", text: `  uptime ${json.uptimeSeconds}s · node ${json.node}` });
          push({ kind: "dim", text: "full panel → /status", href: "/status" });
        } catch {
          push({ kind: "err", text: "stats: could not reach /api/health" });
        }
        setBusy(false);
        break;
      }

      case "gh":
      case "github": {
        setBusy(true);
        try {
          const res = await fetch("/api/github", { cache: "no-store" });
          const j = await res.json();
          if (!j.ok) throw new Error(j.error ?? "unavailable");
          push({ kind: "head", text: `@${j.login} — receipts` });
          push({ kind: "out", text: `  public repos     ${j.publicRepos}` });
          push({ kind: "out", text: `  stars            ${j.totalStars}` });
          push({ kind: "out", text: `  commits sampled  ${j.commits}` });
          push({ kind: "out", text: `  busiest hour     ${String(j.busiestHour).padStart(2, "0")}:00` });
          push({ kind: "out", text: `  after midnight   ${(j.nightOwlShare * 100).toFixed(0)}%` });
          push({ kind: "out", text: `  weekend share    ${(j.weekendShare * 100).toFixed(0)}%` });
          push({ kind: "out", text: `  languages        ${j.languages.join(", ")}` });
          push({ kind: "dim", text: "  routine vs reality → /proof", href: "/proof" });
        } catch (err) {
          push({ kind: "err", text: `gh: ${err instanceof Error ? err.message : "failed"}` });
        }
        setBusy(false);
        break;
      }

      case "day":
      case "now": {
        setBusy(true);
        try {
          const res = await fetch("/api/routine", { cache: "no-store" });
          const json = await res.json();
          push({ kind: "head", text: `${json.clock} ${json.timezone}` });
          if (json.current) {
            push({ kind: "ok", text: `  ${json.current.label}` });
            push({
              kind: "out",
              text: `  ${json.current.start}–${json.current.end} · ${json.current.remaining} left`,
            });
          }
          if (json.next)
            push({ kind: "dim", text: `  next: ${json.next.label} at ${json.next.start}` });
          push({ kind: "dim", text: `  ${json.freeToday} unclaimed today · full dial → /day`, href: "/day" });
        } catch {
          push({ kind: "err", text: "day: could not read the routine" });
        }
        setBusy(false);
        break;
      }

      case "streak": {
        setBusy(true);
        try {
          const res = await fetch("/api/routine", { cache: "no-store" });
          const json = await res.json();
          push({ kind: "head", text: "routine consistency" });
          push({ kind: "out", text: `  current streak   ${json.streak.current} days` });
          push({ kind: "out", text: `  longest          ${json.streak.longest} days` });
          push({ kind: "out", text: `  last 7 days      ${json.week.toFixed(0)}%` });
          push({ kind: "out", text: `  last 30 days     ${json.month.toFixed(0)}%` });
          push({ kind: "dim", text: "  charts → /day", href: "/day" });
        } catch {
          push({ kind: "err", text: "streak: could not read the routine" });
        }
        setBusy(false);
        break;
      }

      case "contact":
        push(
          { kind: "ok", text: data.availability },
          { kind: "out", text: `  email      ${data.email}` },
          { kind: "out", text: `  site       ${data.website}` },
          { kind: "dim", text: "  or `open /hire` for what freelance engagements look like", href: "/hire" },
        );
        break;

      case "theme": {
        const current = document.documentElement.getAttribute("data-theme");
        const next = arg === "dark" || arg === "light" ? arg : current === "light" ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", next);
        try {
          localStorage.setItem("theme", next);
        } catch {
          /* private mode */
        }
        push({ kind: "ok", text: `theme → ${next}` });
        break;
      }

      case "history":
        if (history.length === 0) push({ kind: "dim", text: "nothing yet" });
        [...history].reverse().forEach((h, i) =>
          push({ kind: "out", text: `  ${String(i + 1).padStart(3)}  ${h}` }),
        );
        break;

      case "clear":
        setLines([]);
        break;

      case "exit":
      case "q":
        setOpen(false);
        break;

      case "sudo":
        push({ kind: "err", text: `${data.name} is not in the sudoers file. This incident has been logged.` });
        push({ kind: "dim", text: "(it has not been logged. there is no analytics on this site.)" });
        break;

      case "rm":
        push({ kind: "err", text: "rm: permission denied. the content is on someone else's disk." });
        break;

      case "hire":
        push({ kind: "ok", text: "→ /hire" });
        setOpen(false);
        router.push("/hire");
        break;

      default:
        push({ kind: "err", text: `${command}: command not found. try \`help\`` });
    }
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="no-print fixed bottom-12 right-4 z-40 flex items-center gap-2 rounded-full border px-3.5 py-2 transition-transform hover:-translate-y-0.5"
          style={{
            background: "var(--panel)",
            borderColor: "var(--line-bright)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
          }}
          aria-label="Open terminal"
        >
          <span className="mono" style={{ color: "var(--signal)" }}>
            &gt;_
          </span>
          <span className="mono hidden sm:inline" style={{ color: "var(--faint)" }}>
            terminal
          </span>
          <kbd
            className="mono hidden rounded border px-1 py-0.5 text-[10px] sm:inline"
            style={{ borderColor: "var(--line-bright)", color: "var(--dim)" }}
          >
            `
          </kbd>
        </button>
      )}

      {open && (
        <div className="no-print fixed inset-x-0 bottom-8 z-40 px-2 sm:px-4">
          <div
            className="panel reveal mx-auto flex max-w-[1180px] flex-col overflow-hidden"
            style={{
              height: "min(58vh, 30rem)",
              background: "color-mix(in srgb, var(--panel) 97%, transparent)",
              backdropFilter: "blur(16px)",
              borderColor: "var(--line-bright)",
              boxShadow: "0 -8px 48px rgba(0,0,0,0.4)",
            }}
          >
            <div
              className="flex shrink-0 items-center gap-2 border-b px-3 py-2"
              style={{ borderColor: "var(--line)" }}
            >
              <span className="flex gap-1.5" aria-hidden>
                {["var(--dead)", "var(--faint)", "var(--signal)"].map((c) => (
                  <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
                ))}
              </span>
              <span className="mono ml-1" style={{ color: "var(--faint)" }}>
                {data.name.toLowerCase().replace(/\s+/g, "")}@portfolio — zsh
              </span>
              <button
                onClick={() => setOpen(false)}
                className="mono ml-auto rounded border px-1.5 py-0.5"
                style={{ borderColor: "var(--line-bright)", color: "var(--faint)" }}
              >
                esc
              </button>
            </div>

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-3 py-2.5"
              onClick={() => inputRef.current?.focus()}
            >
              {lines.map((line, i) => {
                const content = (
                  <span
                    className="whitespace-pre-wrap break-words"
                    style={{ color: COLOR[line.kind] }}
                  >
                    {line.kind === "in" && (
                      <span style={{ color: "var(--signal)" }}>❯ </span>
                    )}
                    {line.text}
                  </span>
                );
                return (
                  <div
                    key={i}
                    className="font-[family-name:var(--font-mono)] text-[12.5px] leading-[1.55]"
                  >
                    {line.href ? (
                      <button
                        onClick={() => {
                          setOpen(false);
                          router.push(line.href!);
                        }}
                        className="text-left hover:underline"
                      >
                        {content}
                      </button>
                    ) : (
                      content
                    )}
                  </div>
                );
              })}
              {busy && (
                <div className="font-[family-name:var(--font-mono)] text-[12.5px]" style={{ color: "var(--faint)" }}>
                  working…
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const current = value;
                setValue("");
                void run(current);
              }}
              className="flex shrink-0 items-center gap-2 border-t px-3 py-2.5"
              style={{ borderColor: "var(--line)" }}
            >
              <span
                className="font-[family-name:var(--font-mono)] shrink-0 text-[12.5px]"
                style={{ color: "var(--signal)" }}
              >
                ❯
              </span>
              <input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    const next = Math.min(cursor + 1, history.length - 1);
                    if (history[next] !== undefined) {
                      setCursor(next);
                      setValue(history[next]);
                    }
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    const next = cursor - 1;
                    setCursor(next);
                    setValue(next < 0 ? "" : (history[next] ?? ""));
                  } else if (e.key === "Tab") {
                    e.preventDefault();
                    const partial = value.toLowerCase();
                    const match = COMMANDS.map(([c]) => c.split(" ")[0]).find((c) =>
                      c.startsWith(partial),
                    );
                    if (match) setValue(`${match} `);
                  }
                }}
                spellCheck={false}
                autoComplete="off"
                placeholder="try: neofetch · ls work · ask what has he built with Qdrant"
                className="w-full bg-transparent font-[family-name:var(--font-mono)] text-[12.5px] outline-none"
                style={{ color: "var(--ink)" }}
                aria-label="Terminal input"
              />
            </form>
          </div>
        </div>
      )}
    </>
  );
}
