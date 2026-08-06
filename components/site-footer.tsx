import Link from "next/link";
import type { Profile } from "@/lib/content";

export function SiteFooter({ profile }: { profile: Profile }) {
  return (
    <footer className="no-print mx-auto max-w-[1180px] px-4 pb-24 pt-20">
      <div className="hairline grid gap-8 pt-8 sm:grid-cols-[1fr_auto]">
        <div>
          <p className="mono mb-2" style={{ color: "var(--faint)" }}>
            currently
          </p>
          <p className="text-[14px]" style={{ color: "var(--dim)" }}>
            {profile.availability} —{" "}
            <a href={`mailto:${profile.email}`} className="underline underline-offset-4" style={{ color: "var(--ink)" }}>
              {profile.email}
            </a>
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-5">
          {[
            { href: profile.github, label: "GitHub" },
            { href: profile.linkedin, label: "LinkedIn" },
            { href: profile.x, label: "X" },
            { href: "/hire", label: "Hire" },
            { href: "/resume", label: "Résumé" },
            { href: "/about", label: "About" },
          ].map((l) => (
            <Link key={l.label} href={l.href} className="mono" style={{ color: "var(--dim)" }}>
              {l.label}
            </Link>
          ))}
        </div>
      </div>
      <p className="mono mt-8" style={{ color: "var(--faint)" }}>
        no web fonts · no analytics · no cookies · press ` for a terminal · the
        numbers at the bottom of the screen are real
      </p>
    </footer>
  );
}
