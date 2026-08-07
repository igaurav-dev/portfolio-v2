import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getTrace, span } from "@/lib/trace";
import {
  getProfile,
  getProjects,
  getDecisions,
  getExperiments,
  getSkills,
} from "@/lib/content";
import { SITE_URL, SERVICE_KEYWORDS, SERVICES } from "@/lib/site";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { TraceStrip } from "@/components/trace-strip";
import { CommandPalette, type Command } from "@/components/command-palette";
import { Terminal, type TerminalPayload } from "@/components/terminal";
import { ChunkRecovery } from "@/components/chunk-recovery";
import { themeScript } from "@/components/theme";

// Every page renders per request. That is the point: the telemetry at the
// bottom of the screen describes *your* request, not a build artefact.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Gaurav Kumar — Generative AI & Full Stack Engineer",
    template: "%s — Gaurav Kumar",
  },
  description:
    "Generative AI and full-stack engineer. RAG pipelines, AI agents, vector search on Qdrant, and cloud architecture on Azure and AWS. Available for freelance and consulting work.",
  keywords: SERVICE_KEYWORDS,
  authors: [{ name: "Gaurav Kumar", url: SITE_URL }],
  creator: "Gaurav Kumar",
  alternates: { canonical: "/" },
  openGraph: {
    type: "profile",
    siteName: "Gaurav Kumar",
    url: SITE_URL,
    title: "Gaurav Kumar — Generative AI & Full Stack Engineer",
    description:
      "RAG pipelines, AI agents and vector search, with the cloud architecture underneath. Every claim on this site is checkable from the page you are standing on.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Gaurav Kumar — Generative AI & Full Stack Engineer",
    description:
      "RAG pipelines, AI agents, vector search. A portfolio that shows its own internals.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0b" },
    { media: "(prefers-color-scheme: light)", color: "#f7f7f5" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const trace = getTrace();

  const [profile, projects, decisions, experiments, skills] = await span(
    "layout.data",
    "render",
    () =>
      Promise.all([
        getProfile(),
        getProjects(),
        getDecisions(),
        getExperiments(),
        getSkills(),
      ]),
  );

  const commands: Command[] = [
    { id: "n-home", group: "Navigate", label: "Home — the changelog", href: "/", hint: "G H" },
    { id: "n-work", group: "Navigate", label: "Work", href: "/work", hint: "G W" },
    { id: "n-decisions", group: "Navigate", label: "Decisions — architecture records", href: "/decisions", hint: "G D" },
    { id: "n-graph", group: "Navigate", label: "Graph — the knowledge graph", href: "/graph", hint: "G G" },
    { id: "n-day", group: "Navigate", label: "The day — live routine dial", href: "/day", hint: "G Y" },
    { id: "n-proof", group: "Navigate", label: "Receipts — GitHub vs the claims", href: "/proof", hint: "G P" },
    { id: "n-craft", group: "Navigate", label: "Craft — interactive explainers", href: "/craft", hint: "G C" },
    { id: "n-growth", group: "Navigate", label: "Growth — résumé diffs", href: "/growth" },
    { id: "n-status", group: "Navigate", label: "Status — live telemetry", href: "/status", hint: "G S" },
    { id: "n-ask", group: "Navigate", label: "Ask — retrieval console", href: "/ask", hint: "G A" },
    { id: "n-hire", group: "Navigate", label: "Hire — freelance engagements", href: "/hire" },
    { id: "n-about", group: "Navigate", label: "About", href: "/about", hint: "G B" },
    { id: "n-resume", group: "Navigate", label: "Résumé", href: "/resume", hint: "G R" },
    ...projects.map<Command>((p) => ({
      id: `p-${p.slug}`,
      group: "Work",
      label: `${p.name} — ${p.tagline}`,
      href: `/work/${p.slug}`,
      hint: p.year,
    })),
    ...decisions.map<Command>((d) => ({
      id: `d-${d.id}`,
      group: "Decisions",
      label: d.title,
      href: `/decisions#${d.id}`,
      hint: d.date,
    })),
    ...experiments.map<Command>((e) => ({
      id: `c-${e.id}`,
      group: "Craft",
      label: e.title,
      href: `/craft#${e.id}`,
    })),
    { id: "a-term", group: "Actions", label: "Open the terminal", action: "terminal", hint: "`" },
    { id: "a-trace", group: "Actions", label: "Open the request trace", action: "trace", hint: "T" },
    { id: "a-theme", group: "Actions", label: "Toggle light / dark", action: "theme" },
    {
      id: "a-mail",
      group: "Actions",
      label: `Copy email — ${profile.email}`,
      action: "copy-email",
      payload: profile.email,
    },
    { id: "a-print", group: "Actions", label: "Print the résumé", action: "print" },
  ];

  const terminalData: TerminalPayload = {
    name: profile.name,
    role: profile.role,
    location: profile.location,
    email: profile.email,
    website: profile.website,
    years: profile.yearsExperience,
    availability: profile.availability,
    projects: projects.map((p) => ({
      slug: p.slug,
      name: p.name,
      client: p.client,
      year: p.year,
      status: p.status,
      tagline: p.tagline,
      stack: p.stack,
      metrics: p.metrics.map((m) => ({ label: m.label, value: m.value })),
    })),
    decisions: decisions.map((d) => ({ id: d.id, title: d.title, project: d.project })),
    skills,
    routes: [
      { path: "/", label: "the changelog" },
      { path: "/work", label: "case studies" },
      { path: "/decisions", label: "architecture decision records" },
      { path: "/graph", label: "knowledge graph" },
      { path: "/day", label: "live routine dial" },
      { path: "/proof", label: "receipts — real commit data" },
      { path: "/growth", label: "what changed since the last résumé" },
      { path: "/craft", label: "interactive explainers" },
      { path: "/ask", label: "retrieval console" },
      { path: "/status", label: "live telemetry" },
      { path: "/hire", label: "freelance engagements" },
      { path: "/resume", label: "résumé" },
      { path: "/about", label: "about" },
    ],
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": `${SITE_URL}/#person`,
        name: profile.name,
        url: SITE_URL,
        email: `mailto:${profile.email}`,
        telephone: profile.phone,
        jobTitle: profile.role,
        description: profile.shortStatement,
        address: { "@type": "PostalAddress", addressLocality: "Gurgaon", addressCountry: "IN" },
        knowsAbout: Object.values(skills).flat(),
        sameAs: [profile.website, profile.github, profile.linkedin, profile.x].filter(Boolean),
      },
      {
        "@type": "ProfessionalService",
        "@id": `${SITE_URL}/#service`,
        name: `${profile.name} — Generative AI & Backend Engineering`,
        provider: { "@id": `${SITE_URL}/#person` },
        areaServed: "Worldwide",
        description:
          "Freelance and consulting engagements in RAG pipeline design, AI agents, vector search, and cloud API platform architecture.",
        knowsLanguage: ["en"],
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: "Engineering services",
          itemListElement: SERVICES.map((s) => ({
            "@type": "Offer",
            itemOffered: { "@type": "Service", name: s.name, description: s.summary },
          })),
        },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: profile.name,
        publisher: { "@id": `${SITE_URL}/#person` },
      },
    ],
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        <a
          href="#main"
          className="no-print sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:px-3 focus:py-2"
          style={{ background: "var(--signal)", color: "var(--signal-ink)" }}
        >
          Skip to content
        </a>

        <div className="relative z-10 flex min-h-dvh flex-col">
          <SiteNav profile={profile} />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter profile={profile} />
        </div>

        <ChunkRecovery />
        <CommandPalette commands={commands} />
        <Terminal data={terminalData} />
        <TraceStrip traceId={trace.id} />
      </body>
    </html>
  );
}
