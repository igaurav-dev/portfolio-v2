import { cache } from "react";
import { span } from "./trace";
import { readList, readSingleton, saveSingleton, replaceList } from "./store";

/* ------------------------------------------------------------------
   Content comes from the store at request time — MongoDB when it is
   configured, JSON files otherwise. Reading per request rather than
   importing at build time is what lets the admin panel change the site
   without a redeploy, and what makes the spans in the trace real.
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

const EMPTY_PROFILE = {} as Profile;

export const getProjects = cache(() => readList<Project>("projects"));
export const getDecisions = cache(() => readList<Decision>("decisions"));
export const getExperiments = cache(() => readList<Experiment>("experiments"));
export const getTimeline = cache(() => readList<Role>("timeline"));
export const getDeltas = cache(() => readList<ResumeDelta>("deltas"));
export const getProfile = cache(() => readSingleton<Profile>("profile", EMPTY_PROFILE));
export const getSkills = cache(() => readSingleton<Skills>("skills", {}));

/** Used by the admin panel. */
export async function save(file: string, data: unknown): Promise<void> {
  const map: Record<string, { name: Parameters<typeof readList>[0]; single: boolean }> = {
    "profile.json": { name: "profile", single: true },
    "skills.json": { name: "skills", single: true },
    "routine.json": { name: "routine", single: true },
    "projects.json": { name: "projects", single: false },
    "decisions.json": { name: "decisions", single: false },
    "timeline.json": { name: "timeline", single: false },
    "craft.json": { name: "experiments", single: false },
    "deltas.json": { name: "deltas", single: false },
  };
  const target = map[file];
  if (!target) throw new Error(`unknown content file: ${file}`);
  if (target.single) await saveSingleton(target.name, data as Record<string, unknown>);
  else await replaceList(target.name, data as Record<string, unknown>[]);
}

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
