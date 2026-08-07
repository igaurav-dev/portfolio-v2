import Link from "next/link";
import type { Profile } from "@/lib/content";
import { getRepoCard } from "@/lib/github";
import { SITE_URL } from "@/lib/site";

const CLOSERS = [
  "No cookie banner, because there are no cookies. There is exactly one, it only exists if you log into the admin, and it is a signature.",
  "No analytics. If you want me to know you were here, the email address is right there.",
  "Zero web fonts. The layout has never shifted once and it is never going to.",
  "Every number on this site is measured. The ones I could not measure honestly are not shown.",
  "The trace bar at the bottom is not a decoration. It is reading the actual spans from the request that drew this page.",
  "Built at hours the routine on /day does not entirely account for.",
  "If something here looks wrong, it probably is. The code is public — the issues tab is right there.",
];

const PAGES = [
  { href: "/work", label: "Work" },
  { href: "/decisions", label: "Decisions" },
  { href: "/graph", label: "Knowledge graph" },
  { href: "/craft", label: "Craft" },
  { href: "/day", label: "The day" },
  { href: "/proof", label: "Receipts" },
];

const META = [
  { href: "/ask", label: "Ask the corpus" },
  { href: "/status", label: "Live telemetry" },
  { href: "/growth", label: "What changed" },
  { href: "/hire", label: "Hire me" },
  { href: "/resume", label: "Résumé" },
  { href: "/about", label: "About" },
];

function ago(iso: string | null): string {
  if (!iso) return "";
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 30) return `${Math.floor(days)}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export async function SiteFooter({ profile }: { profile: Profile }) {
  const repo = await getRepoCard();
  const closer = CLOSERS[Math.floor(Math.random() * CLOSERS.length)];
  const year = new Date().getFullYear();

  return (
    <footer className="no-print relative mt-24">
      <div
        className="border-t"
        style={{
          borderColor: "var(--line)",
          background:
            "linear-gradient(180deg, transparent, color-mix(in srgb, var(--panel) 70%, transparent))",
        }}
      >
        <div className="mx-auto max-w-[1180px] px-4">
          {/* ---------------- the ask ---------------- */}
          <section className="border-b py-14" style={{ borderColor: "var(--line)" }}>
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <span className="pulse-dot" aria-hidden />
                  <span className="mono" style={{ color: "var(--signal)" }}>
                    {profile.availability}
                  </span>
                </div>
                <h2 className="text-[clamp(1.7rem,5vw,2.8rem)] font-medium leading-[1.05] tracking-[-0.035em]">
                  Tell me what isn&rsquo;t working.
                </h2>
                <a
                  href={`mailto:${profile.email}`}
                  className="group mt-4 inline-flex items-baseline gap-2 text-[clamp(1rem,2.4vw,1.35rem)]"
                  style={{ color: "var(--ink)" }}
                >
                  <span
                    className="underline decoration-[var(--line-bright)] underline-offset-[6px] transition-colors group-hover:decoration-[var(--signal)]"
                  >
                    {profile.email}
                  </span>
                  <span
                    className="transition-transform group-hover:translate-x-1"
                    style={{ color: "var(--signal)" }}
                    aria-hidden
                  >
                    →
                  </span>
                </a>
              </div>

              {/* ---------------- the repo card ---------------- */}
              <a
                href={repo.url}
                target="_blank"
                rel="noreferrer noopener"
                className="group panel block w-full max-w-sm overflow-hidden p-4 transition-transform hover:-translate-y-0.5"
                style={{ borderColor: "var(--line-bright)" }}
              >
                <div className="flex items-center gap-2">
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden style={{ color: "var(--dim)" }}>
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
                  </svg>
                  <span className="num text-[13px]" style={{ color: "var(--ink)" }}>
                    {repo.fullName}
                  </span>
                  <span
                    className="mono ml-auto transition-transform group-hover:translate-x-0.5"
                    style={{ color: "var(--signal)" }}
                    aria-hidden
                  >
                    ↗
                  </span>
                </div>

                <p className="mt-2.5 text-[13px] leading-relaxed" style={{ color: "var(--dim)" }}>
                  The code for the page you are looking at. Including the parts I would
                  not put on the résumé.
                </p>

                <div className="mono mt-3 flex flex-wrap items-center gap-x-4 gap-y-1" style={{ color: "var(--faint)" }}>
                  {repo.ok ? (
                    <>
                      <span style={{ color: repo.stars > 0 ? "var(--signal)" : "var(--faint)" }}>
                        ★ {repo.stars}
                      </span>
                      <span>⑂ {repo.forks}</span>
                      {repo.language && <span>{repo.language}</span>}
                      {repo.pushedAt && <span>pushed {ago(repo.pushedAt)}</span>}
                    </>
                  ) : (
                    <span>github is rate limiting me — the link still works</span>
                  )}
                </div>
              </a>
            </div>
          </section>

          {/* ---------------- links ---------------- */}
          <section className="grid gap-10 border-b py-12 sm:grid-cols-2 lg:grid-cols-4" style={{ borderColor: "var(--line)" }}>
            <div>
              <p className="mono mb-3" style={{ color: "var(--faint)" }}>
                the work
              </p>
              <ul className="space-y-1.5">
                {PAGES.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-[13.5px] underline decoration-transparent underline-offset-4 transition-colors hover:decoration-[var(--signal)]"
                      style={{ color: "var(--dim)" }}
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mono mb-3" style={{ color: "var(--faint)" }}>
                the rest
              </p>
              <ul className="space-y-1.5">
                {META.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-[13.5px] underline decoration-transparent underline-offset-4 transition-colors hover:decoration-[var(--signal)]"
                      style={{ color: "var(--dim)" }}
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mono mb-3" style={{ color: "var(--faint)" }}>
                elsewhere
              </p>
              <ul className="space-y-1.5">
                {[
                  { href: profile.github, label: "GitHub" },
                  { href: profile.linkedin, label: "LinkedIn" },
                  { href: profile.x, label: "X" },
                  { href: profile.website, label: "Website" },
                ]
                  // Drop empties, and drop anything pointing back at this
                  // site — a footer link to the page you are already on is
                  // just noise.
                  .filter(
                    (l) =>
                      l.href &&
                      l.href.replace(/\/$/, "") !== SITE_URL.replace(/\/$/, ""),
                  )
                  .map((l) => (
                    <li key={l.label}>
                      <a
                        href={l.href}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-[13.5px] underline decoration-transparent underline-offset-4 transition-colors hover:decoration-[var(--signal)]"
                        style={{ color: "var(--dim)" }}
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
              </ul>
            </div>

            <div>
              <p className="mono mb-3" style={{ color: "var(--faint)" }}>
                try pressing
              </p>
              <ul className="space-y-1.5">
                {[
                  ["`", "a real terminal"],
                  ["⌘K", "jump anywhere"],
                  ["T", "the request trace"],
                  ["?", "every shortcut"],
                ].map(([key, what]) => (
                  <li key={key} className="flex items-center gap-2.5">
                    <kbd
                      className="mono rounded border px-1.5 py-0.5"
                      style={{ borderColor: "var(--line-bright)", color: "var(--ink)" }}
                    >
                      {key}
                    </kbd>
                    <span className="text-[13px]" style={{ color: "var(--dim)" }}>
                      {what}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* ---------------- colophon ---------------- */}
          <section className="flex flex-col gap-5 py-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-[62ch]">
              <p className="text-[13px] leading-relaxed" style={{ color: "var(--dim)" }}>
                {closer}
              </p>
              <p className="mono mt-3" style={{ color: "var(--faint)" }}>
                next.js · typescript · mongodb · no web fonts · no analytics ·{" "}
                {repo.license && `${repo.license} · `}© {year} {profile.name}
              </p>
            </div>

            <p
              className="mono shrink-0 leading-relaxed lg:text-right"
              style={{ color: "var(--faint)" }}
            >
              made in {profile.location.split(",")[0]}
              <br />
              between 00:00 and 00:45, allegedly
            </p>
          </section>
        </div>
      </div>
    </footer>
  );
}
