import type { CollectionName } from "./store";

/* ------------------------------------------------------------------
   One schema description drives every editor in the admin panel, so
   adding a field is a one-line change here rather than a new form.
   ------------------------------------------------------------------ */

export type FieldType =
  | "text"
  | "textarea"
  | "tags"
  | "lines"
  | "select"
  | "days"
  | "time"
  | "objects";

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  hint?: string;
  placeholder?: string;
  options?: string[];
  /** for type: "objects" */
  fields?: Field[];
  rows?: number;
  required?: boolean;
  /** shown in the list view rather than only in the editor */
  summary?: boolean;
}

export interface CollectionSchema {
  name: CollectionName;
  label: string;
  singleton: boolean;
  idField: string;
  titleField: string;
  subtitleField?: string;
  description: string;
  fields: Field[];
  blank: Record<string, unknown>;
}

const METRIC_FIELDS: Field[] = [
  { key: "label", label: "Label", type: "text", placeholder: "Requests served" },
  { key: "value", label: "Value", type: "text", placeholder: "2M+/day" },
  { key: "note", label: "Note", type: "text", placeholder: "across both product lines" },
];

const LINK_FIELDS: Field[] = [
  { key: "label", label: "Label", type: "text" },
  { key: "href", label: "URL", type: "text" },
];

const ALTERNATIVE_FIELDS: Field[] = [
  { key: "option", label: "Option rejected", type: "text" },
  { key: "why", label: "Why it lost", type: "textarea", rows: 2 },
];

export const SCHEMAS: CollectionSchema[] = [
  {
    name: "profile",
    label: "Profile",
    singleton: true,
    idField: "_id",
    titleField: "name",
    description: "Identity, contact details and the principles shown on /about.",
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "role", label: "Headline title", type: "text", required: true },
      { key: "handle", label: "Handle", type: "text" },
      { key: "location", label: "Location", type: "text" },
      { key: "timezone", label: "Timezone", type: "text", hint: "IANA, e.g. Asia/Kolkata" },
      { key: "email", label: "Email", type: "text" },
      { key: "phone", label: "Phone", type: "text" },
      { key: "website", label: "Website", type: "text" },
      { key: "github", label: "GitHub URL", type: "text" },
      { key: "linkedin", label: "LinkedIn URL", type: "text" },
      { key: "x", label: "X URL", type: "text" },
      { key: "yearsExperience", label: "Years of experience", type: "text", hint: "e.g. 4+" },
      { key: "availability", label: "Availability line", type: "text" },
      { key: "shortStatement", label: "One-liner", type: "textarea", rows: 2, hint: "Used in OG images and meta descriptions. Under 140 chars." },
      { key: "statement", label: "Statement", type: "textarea", rows: 4 },
      { key: "principles", label: "Principles", type: "lines", hint: "One per line. Shown numbered on /about." },
    ],
    blank: {},
  },
  {
    name: "projects",
    label: "Projects",
    singleton: false,
    idField: "slug",
    titleField: "name",
    subtitleField: "tagline",
    description: "Case studies on /work. Extraction fills most of this; the two fields it cannot write are the ones that matter most.",
    fields: [
      { key: "slug", label: "Slug", type: "text", required: true, hint: "URL segment — /work/<slug>. Changing it breaks existing links." },
      { key: "name", label: "Name", type: "text", required: true, summary: true },
      { key: "client", label: "Client / employer", type: "text", summary: true },
      { key: "tagline", label: "Tagline", type: "textarea", rows: 2, hint: "One sentence, concrete. No adjectives like 'robust'." },
      { key: "year", label: "Year", type: "text", summary: true },
      { key: "role", label: "Your role", type: "text" },
      { key: "duration", label: "Duration", type: "text" },
      { key: "status", label: "Status", type: "text", placeholder: "in production" },
      { key: "kind", label: "Kind", type: "select", options: ["company", "personal"] },
      { key: "stack", label: "Stack", type: "tags", hint: "These become nodes on /graph." },
      { key: "summary", label: "Summary", type: "textarea", rows: 4 },
      { key: "problem", label: "The problem", type: "textarea", rows: 5 },
      { key: "approach", label: "Approach", type: "lines", hint: "One numbered step per line." },
      { key: "metrics", label: "Results", type: "objects", fields: METRIC_FIELDS, hint: "Only numbers that are actually true. This is the part people check." },
      { key: "tradeoffs", label: "Trade-offs accepted", type: "textarea", rows: 4, hint: "The cost you paid, not the win you got. Most-quoted section in an interview." },
      { key: "wentWrong", label: "What went wrong", type: "textarea", rows: 5, hint: "Renders only when filled. The single highest-value thing on the page — name a specific misjudgement." },
      { key: "links", label: "Links", type: "objects", fields: LINK_FIELDS },
    ],
    blank: {
      slug: "", name: "", client: "", tagline: "", year: String(new Date().getFullYear()),
      role: "", duration: "", status: "in production", kind: "company",
      stack: [], summary: "", problem: "", approach: [], metrics: [],
      tradeoffs: "", wentWrong: "", links: [],
    },
  },
  {
    name: "decisions",
    label: "Decisions",
    singleton: false,
    idField: "id",
    titleField: "title",
    subtitleField: "decision",
    description: "Architecture decision records on /decisions. A decision without its rejected alternatives is not reviewable.",
    fields: [
      { key: "id", label: "ID", type: "text", required: true, hint: "kebab-case; becomes the #anchor" },
      { key: "title", label: "Title", type: "text", required: true, summary: true },
      { key: "project", label: "Project slug", type: "text", hint: "Links this record to a project on /work.", summary: true },
      { key: "date", label: "Date", type: "text", placeholder: "2026-03", summary: true },
      { key: "status", label: "Status", type: "select", options: ["adopted", "superseded", "proposed", "reversed"] },
      { key: "context", label: "Context", type: "textarea", rows: 4 },
      { key: "decision", label: "Decision", type: "textarea", rows: 3 },
      { key: "alternatives", label: "Alternatives considered", type: "objects", fields: ALTERNATIVE_FIELDS },
      { key: "consequence", label: "Consequence", type: "textarea", rows: 3, hint: "What this cost. Be specific." },
    ],
    blank: {
      id: "", title: "", project: "", date: new Date().toISOString().slice(0, 7),
      status: "adopted", context: "", decision: "", alternatives: [], consequence: "",
    },
  },
  {
    name: "timeline",
    label: "Experience",
    singleton: false,
    idField: "org",
    titleField: "role",
    subtitleField: "org",
    description: "Employment history on /resume and /about.",
    fields: [
      { key: "org", label: "Organisation", type: "text", required: true, summary: true },
      { key: "role", label: "Role", type: "text", required: true, summary: true },
      { key: "period", label: "Period", type: "text", placeholder: "Feb 2026 — present", summary: true },
      { key: "location", label: "Location", type: "text" },
      { key: "note", label: "Summary", type: "textarea", rows: 4 },
      { key: "highlights", label: "Highlights", type: "lines", hint: "One bullet per line." },
    ],
    blank: { org: "", role: "", period: "", location: "", note: "", highlights: [] },
  },
  {
    name: "skills",
    label: "Skills",
    singleton: true,
    idField: "_id",
    titleField: "_id",
    description: "Technology groups. Every entry becomes a node on /graph and is checked against public code on /proof.",
    fields: [],
    blank: {},
  },
  {
    name: "experiments",
    label: "Craft",
    singleton: false,
    idField: "id",
    titleField: "title",
    subtitleField: "blurb",
    description: "Metadata for the interactive explainers on /craft. The widgets themselves are components keyed by id.",
    fields: [
      { key: "id", label: "ID", type: "text", required: true, hint: "Must match a component key in app/craft/page.tsx" },
      { key: "title", label: "Title", type: "text", required: true, summary: true },
      { key: "blurb", label: "Blurb", type: "textarea", rows: 3 },
      { key: "kind", label: "Kind", type: "select", options: ["simulation", "visualisation", "explainer"] },
    ],
    blank: { id: "", title: "", blurb: "", kind: "simulation" },
  },
  {
    name: "deltas",
    label: "Résumé history",
    singleton: false,
    idField: "at",
    titleField: "summary",
    subtitleField: "source",
    description: "Diffs written by résumé ingest, shown on /growth. Usually you delete from here rather than add.",
    fields: [
      { key: "at", label: "Timestamp", type: "text", required: true },
      { key: "source", label: "Source file", type: "text" },
      { key: "summary", label: "Summary", type: "textarea", rows: 2, summary: true },
      { key: "learned", label: "Newly learned", type: "tags" },
      { key: "added", label: "Added", type: "lines" },
      { key: "changed", label: "Changed", type: "lines" },
    ],
    blank: { at: new Date().toISOString(), source: "", summary: "", learned: [], added: [], changed: [] },
  },
];

export function schemaFor(name: string): CollectionSchema | undefined {
  return SCHEMAS.find((s) => s.name === name);
}
