import Link from "next/link";
import type { ReactNode } from "react";

export function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[1180px] px-4">{children}</div>;
}

export function PageHead({
  label,
  title,
  lede,
  aside,
}: {
  label: string;
  title: string;
  lede?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="reveal border-b py-14 sm:py-20" style={{ borderColor: "var(--line)" }}>
      <p className="mono mb-4" style={{ color: "var(--signal)" }}>
        {label}
      </p>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <h1 className="display max-w-[18ch]">{title}</h1>
          {lede && <p className="prose-body mt-5">{lede}</p>}
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
    </div>
  );
}

export function Tag({ children, tone = "dim" }: { children: ReactNode; tone?: "dim" | "signal" | "dead" }) {
  const color =
    tone === "signal" ? "var(--signal)" : tone === "dead" ? "var(--dead)" : "var(--faint)";
  return (
    <span
      className="mono inline-flex shrink-0 items-center rounded border px-1.5 py-0.5"
      style={{ borderColor: "var(--line-bright)", color }}
    >
      {children}
    </span>
  );
}

export function Stat({
  value,
  label,
  tone = "ink",
}: {
  value: string;
  label: string;
  tone?: "ink" | "signal" | "dead";
}) {
  const color =
    tone === "signal" ? "var(--signal)" : tone === "dead" ? "var(--dead)" : "var(--ink)";
  return (
    <div>
      <p className="num text-[22px] leading-tight" style={{ color }}>
        {value}
      </p>
      <p className="mono mt-1" style={{ color: "var(--faint)" }}>
        {label}
      </p>
    </div>
  );
}

export function SectionTitle({ children, count }: { children: ReactNode; count?: string }) {
  return (
    <div className="mb-1 flex items-baseline justify-between gap-4 pb-3">
      <h2 className="mono" style={{ color: "var(--faint)" }}>
        {children}
      </h2>
      {count && (
        <span className="mono" style={{ color: "var(--faint)" }}>
          {count}
        </span>
      )}
    </div>
  );
}

export function Callout({ children, tone = "signal" }: { children: ReactNode; tone?: "signal" | "dead" }) {
  return (
    <div
      className="my-8 border-l-2 py-1 pl-5"
      style={{ borderColor: tone === "dead" ? "var(--dead)" : "var(--signal)" }}
    >
      {children}
    </div>
  );
}

export function ArrowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1.5 text-[14px]"
      style={{ color: "var(--ink)" }}
    >
      <span className="underline decoration-transparent underline-offset-4 transition-colors group-hover:decoration-[var(--signal)]">
        {children}
      </span>
      <span
        className="transition-transform group-hover:translate-x-0.5"
        style={{ color: "var(--signal)" }}
        aria-hidden
      >
        →
      </span>
    </Link>
  );
}
