import Link from "next/link";
import { LocalClock } from "./local-clock";
import { ThemeToggle } from "./theme";
import type { Profile } from "@/lib/content";

const LINKS = [
  { href: "/work", label: "Work" },
  { href: "/decisions", label: "Decisions" },
  { href: "/graph", label: "Graph" },
  { href: "/day", label: "Day" },
  { href: "/proof", label: "Receipts" },
  { href: "/craft", label: "Craft" },
  { href: "/ask", label: "Ask" },
  { href: "/status", label: "Status" },
  { href: "/hire", label: "Hire" },
];

export function SiteNav({ profile }: { profile: Profile }) {
  return (
    <header
      className="no-print sticky top-0 z-30 border-b"
      style={{
        borderColor: "var(--line)",
        background: "color-mix(in srgb, var(--bg) 82%, transparent)",
        backdropFilter: "blur(14px)",
      }}
    >
      <nav className="mx-auto flex max-w-[1180px] items-center gap-5 px-4 py-3">
        <Link href="/" className="group shrink-0 text-[14px] font-medium tracking-tight">
          {profile.name}
          <span
            className="mono ml-2 hidden align-middle transition-opacity group-hover:opacity-100 sm:inline"
            style={{ color: "var(--signal)", opacity: 0.55 }}
          >
            &gt;_
          </span>
        </Link>

        <div className="hidden items-center gap-4 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[13.5px] transition-colors"
              style={{ color: "var(--dim)" }}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-4">
          <LocalClock timezone={profile.timezone} city={profile.location.split(",")[0]} />
          <ThemeToggle />
          <span
            className="mono hidden items-center gap-1.5 rounded border px-2 py-1 lg:inline-flex"
            style={{ borderColor: "var(--line-bright)", color: "var(--faint)" }}
          >
            ⌘K
          </span>
        </div>
      </nav>

      <div className="flex gap-4 overflow-x-auto border-t px-4 py-2 md:hidden" style={{ borderColor: "var(--line)" }}>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="mono shrink-0" style={{ color: "var(--dim)" }}>
            {l.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
