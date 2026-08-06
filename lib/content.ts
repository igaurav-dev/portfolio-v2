import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { span } from "./trace";

/* ------------------------------------------------------------------
   Content is read from disk at request time rather than imported, so
   the spans in the trace strip measure real I/O — and so the admin
   panel can write to the same files the site reads from.
   ------------------------------------------------------------------ */

export interface Metric {
  label: string;
  value: string;
  note?: string;
}

export interface ProjectLink {
  label: string;
  href: string;
}

export interface Project {
  slug: string;
  name: string;
  client: string;
  tagline: string;
  year: string;
  role: string;
  duration: string;
  status: string;
  kind: "company" | "personal";
  stack: string[];
  summary: string;
  problem: string;
  approach: string[];
  metrics: Metric[];
  tradeoffs: string;
  wentWrong: string;
  links: ProjectLink[];
}

export interface Alternative {
  option: string;
  why: string;
}

export interface Decision {
  id: string;
  title: string;
  project: string;
  date: string;
  status: string;
  context: string;
  decision: string;
  alternatives: Alternative[];
  consequence: string;
}

export interface Experiment {
  id: string;
  title: string;
  blurb: string;
  kind: string;
}

export interface Role {
  org: string;
  role: string;
  period: string;
  location: string;
  note: string;
  highlights: string[];
}

export interface Profile {
  name: string;
  handle: string;
  role: string;
  location: string;
  timezone: string;
  email: string;
  phone: string;
  website: string;
  github: string;
  linkedin: string;
  x: string;
  yearsExperience: string;
  availability: string;
  statement: string;
  shortStatement: string;
  principles: string[];
}

export type Skills = Record<string, string[]>;

export interface ResumeDelta {
  at: string;
  source: string;
  learned: string[];
  added: string[];
  changed: string[];
  summary: string;
}

const CONTENT_DIR = path.join(process.cwd(), "content");

async function load<T>(file: string, fallback?: T): Promise<T> {
  return span(`fs.read content/${file}`, "io", async () => {
    try {
      const raw = await readFile(path.join(CONTENT_DIR, file), "utf8");
      return JSON.parse(raw) as T;
    } catch (err) {
      if (fallback !== undefined) return fallback;
      throw err;
    }
  });
}

/** Used by the admin panel. Writes atomically-ish via a temp file. */
export async function save(file: string, data: unknown): Promise<void> {
  await mkdir(CONTENT_DIR, { recursive: true });
  const target = path.join(CONTENT_DIR, file);
  const tmp = `${target}.tmp`;
  await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  const { rename } = await import("node:fs/promises");
  await rename(tmp, target);
}

export const getProjects = cache(() => load<Project[]>("projects.json"));
export const getDecisions = cache(() => load<Decision[]>("decisions.json", []));
export const getExperiments = cache(() => load<Experiment[]>("craft.json"));
export const getTimeline = cache(() => load<Role[]>("timeline.json"));
export const getProfile = cache(() => load<Profile>("profile.json"));
export const getSkills = cache(() => load<Skills>("skills.json", {}));
export const getDeltas = cache(() => load<ResumeDelta[]>("deltas.json", []));

export async function getProject(slug: string): Promise<Project | undefined> {
  const projects = await getProjects();
  return span("index.lookup project", "compute", () =>
    projects.find((p) => p.slug === slug),
  );
}

/* ---------------- the unified feed ---------------- */

export type FeedKind = "ship" | "decide" | "craft" | "role" | "learn";

export interface FeedItem {
  kind: FeedKind;
  date: string;
  title: string;
  detail: string;
  href?: string;
  meta?: string;
}

const KIND_ORDER: Record<FeedKind, number> = {
  ship: 0,
  decide: 1,
  learn: 2,
  craft: 3,
  role: 4,
};

function periodStart(period: string): string {
  const match = period.match(/(\d{4})/);
  return `${match?.[1] ?? "2022"}-01-01`;
}

/**
 * Everything that has happened, in one lane. A portfolio is a changelog
 * that someone reformatted into a brochure; this puts it back.
 */
export const getFeed = cache(async (): Promise<FeedItem[]> => {
  const [projects, decisions, experiments, timeline, deltas] = await Promise.all([
    getProjects(),
    getDecisions(),
    getExperiments(),
    getTimeline(),
    getDeltas(),
  ]);

  return span("feed.merge", "compute", () => {
    const items: FeedItem[] = [
      ...projects.map<FeedItem>((p) => ({
        kind: "ship",
        date: `${p.year}-11-01`,
        title: p.name,
        detail: p.tagline,
        href: `/work/${p.slug}`,
        meta: `${p.client} · ${p.stack.slice(0, 3).join(" · ")}`,
      })),
      ...decisions.map<FeedItem>((d) => ({
        kind: "decide",
        date: `${d.date}-15`,
        title: d.title,
        detail: d.context,
        href: `/decisions#${d.id}`,
        meta: `${d.alternatives.length} alternatives weighed`,
      })),
      ...experiments.map<FeedItem>((e) => ({
        kind: "craft",
        date: "2026-01-15",
        title: e.title,
        detail: e.blurb,
        href: `/craft#${e.id}`,
        meta: e.kind,
      })),
      ...timeline.map<FeedItem>((r) => ({
        kind: "role",
        date: periodStart(r.period),
        title: `${r.role} · ${r.org}`,
        detail: r.note,
        href: "/resume",
        meta: r.location,
      })),
      ...deltas.flatMap<FeedItem>((d) =>
        d.learned.map((l) => ({
          kind: "learn" as const,
          date: d.at.slice(0, 10),
          title: l,
          detail: d.summary,
          href: "/growth",
          meta: "picked up",
        })),
      ),
    ];

    return items.sort((a, b) => {
      const cmp = b.date.localeCompare(a.date);
      return cmp !== 0 ? cmp : KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    });
  });
});
