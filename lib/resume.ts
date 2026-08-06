import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { Profile, Project, Role, Skills, ResumeDelta } from "./content";

/* ------------------------------------------------------------------
   Résumé ingestion.
   The PDF goes to Claude as a document block — no PDF parsing library,
   no text-extraction step to go wrong on a two-column layout. The model
   is constrained by a tool schema so it returns structured JSON or
   nothing, and the result is diffed against the live corpus before it
   is allowed anywhere near the content files.
   ------------------------------------------------------------------ */

export const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

export interface StoredUpload {
  id: string;
  name: string;
  bytes: number;
  uploadedAt: string;
}

export async function saveUpload(
  name: string,
  data: Uint8Array,
): Promise<StoredUpload> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const id = `${Date.now()}-${safe}`;
  await writeFile(path.join(UPLOAD_DIR, id), data);
  return { id, name: safe, bytes: data.byteLength, uploadedAt: new Date().toISOString() };
}

export async function listUploads(): Promise<StoredUpload[]> {
  try {
    const names = await readdir(UPLOAD_DIR);
    const entries = await Promise.all(
      names.map(async (id) => {
        const info = await stat(path.join(UPLOAD_DIR, id));
        return {
          id,
          name: id.replace(/^\d+-/, ""),
          bytes: info.size,
          uploadedAt: info.mtime.toISOString(),
        };
      }),
    );
    return entries.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  } catch {
    return [];
  }
}

export async function readUpload(id: string): Promise<Buffer> {
  const safe = path.basename(id);
  return readFile(path.join(UPLOAD_DIR, safe));
}

/* ---------------- extraction ---------------- */

export interface Extraction {
  profile: Partial<Profile>;
  skills: Skills;
  timeline: Role[];
  projects: Partial<Project>[];
}

const EXTRACT_TOOL = {
  name: "record_resume",
  description: "Record every field extracted from the résumé.",
  input_schema: {
    type: "object",
    properties: {
      profile: {
        type: "object",
        properties: {
          name: { type: "string" },
          role: { type: "string", description: "headline job title" },
          location: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          website: { type: "string" },
          yearsExperience: { type: "string", description: "e.g. '4+'" },
          statement: { type: "string", description: "2-3 sentence professional summary in third person" },
          shortStatement: { type: "string", description: "one line, under 140 characters" },
        },
        required: ["name", "role"],
      },
      skills: {
        type: "object",
        description: "Map of category name to list of technologies, exactly as grouped in the résumé.",
        additionalProperties: { type: "array", items: { type: "string" } },
      },
      timeline: {
        type: "array",
        items: {
          type: "object",
          properties: {
            org: { type: "string" },
            role: { type: "string" },
            period: { type: "string", description: "e.g. 'Feb 2026 — present'" },
            location: { type: "string" },
            note: { type: "string", description: "2-3 sentence summary of the role" },
            highlights: { type: "array", items: { type: "string" } },
          },
          required: ["org", "role", "period", "location", "note", "highlights"],
        },
      },
      projects: {
        type: "array",
        items: {
          type: "object",
          properties: {
            slug: { type: "string", description: "kebab-case identifier" },
            name: { type: "string" },
            client: { type: "string", description: "company, or 'Personal'" },
            tagline: { type: "string", description: "one sentence, concrete, no adjectives like 'robust'" },
            year: { type: "string" },
            role: { type: "string" },
            status: { type: "string" },
            kind: { type: "string", enum: ["company", "personal"] },
            stack: { type: "array", items: { type: "string" } },
            summary: { type: "string" },
            problem: { type: "string", description: "the problem this existed to solve; infer conservatively" },
            approach: { type: "array", items: { type: "string" } },
            metrics: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  value: { type: "string" },
                  note: { type: "string" },
                },
                required: ["label", "value"],
              },
              description: "ONLY numbers that literally appear in the résumé. Never estimate.",
            },
          },
          required: ["slug", "name", "client", "tagline", "year", "stack", "summary"],
        },
      },
    },
    required: ["profile", "skills", "timeline", "projects"],
  },
} as const;

const EXTRACT_SYSTEM = `You extract structured data from a résumé PDF.

Hard rules:
- Only record what the document actually says. Never invent a metric, date, employer or technology.
- Metrics must be figures that literally appear in the text. If a project has no numbers, return an empty metrics array.
- "problem" and "approach" may be inferred from the bullet points, but only from what is written — stay close to the source.
- Write taglines and summaries in plain, concrete prose. No marketing adjectives.
- Preserve the résumé's own skill groupings.
- Call the record_resume tool exactly once.`;

export async function extractFromPdf(pdf: Buffer): Promise<Extraction> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set — extraction needs it. You can still edit content by hand.",
    );
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.EXTRACT_MODEL ?? "claude-sonnet-4-5",
      max_tokens: 8000,
      system: EXTRACT_SYSTEM,
      tools: [EXTRACT_TOOL],
      tool_choice: { type: "tool", name: "record_resume" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdf.toString("base64"),
              },
            },
            { type: "text", text: "Extract everything from this résumé." },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`anthropic ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    content: { type: string; name?: string; input?: unknown }[];
  };
  const call = data.content.find((c) => c.type === "tool_use" && c.name === "record_resume");
  if (!call?.input) throw new Error("the model returned no structured output");
  return call.input as Extraction;
}

/* ---------------- diffing ---------------- */

function flattenSkills(skills: Skills): Set<string> {
  return new Set(Object.values(skills).flat().map((s) => s.toLowerCase().trim()));
}

export interface DiffInput {
  extraction: Extraction;
  currentSkills: Skills;
  currentProjects: Project[];
  currentTimeline: Role[];
  currentProfile: Profile;
  source: string;
}

/**
 * Pure, local, and deterministic — no model involved. The interesting
 * output is `learned`: technologies present in the new résumé that the
 * site had never heard of.
 */
export function diffResume(input: DiffInput): ResumeDelta {
  const { extraction, currentSkills, currentProjects, currentTimeline, currentProfile } = input;

  const known = flattenSkills(currentSkills);
  for (const p of currentProjects) for (const s of p.stack) known.add(s.toLowerCase().trim());

  const incoming = new Map<string, string>();
  for (const s of Object.values(extraction.skills ?? {}).flat())
    incoming.set(s.toLowerCase().trim(), s);
  for (const p of extraction.projects ?? [])
    for (const s of p.stack ?? []) incoming.set(s.toLowerCase().trim(), s);

  const learned = [...incoming.entries()]
    .filter(([lower]) => !known.has(lower))
    .map(([, original]) => original)
    .sort();

  const knownProjects = new Set(currentProjects.map((p) => p.name.toLowerCase()));
  const knownOrgs = new Set(currentTimeline.map((r) => r.org.toLowerCase()));

  const added: string[] = [];
  for (const p of extraction.projects ?? [])
    if (p.name && !knownProjects.has(p.name.toLowerCase()))
      added.push(`project: ${p.name}`);
  for (const r of extraction.timeline ?? [])
    if (!knownOrgs.has(r.org.toLowerCase())) added.push(`role: ${r.role} at ${r.org}`);

  const changed: string[] = [];
  const p = extraction.profile ?? {};
  if (p.role && p.role !== currentProfile.role)
    changed.push(`title: "${currentProfile.role}" → "${p.role}"`);
  if (p.location && p.location !== currentProfile.location)
    changed.push(`location: ${currentProfile.location} → ${p.location}`);
  if (p.yearsExperience && p.yearsExperience !== currentProfile.yearsExperience)
    changed.push(`experience: ${currentProfile.yearsExperience} → ${p.yearsExperience}`);
  for (const r of extraction.timeline ?? []) {
    const existing = currentTimeline.find((c) => c.org.toLowerCase() === r.org.toLowerCase());
    if (existing && existing.role !== r.role)
      changed.push(`${r.org}: ${existing.role} → ${r.role}`);
  }

  const bits: string[] = [];
  if (learned.length) bits.push(`${learned.length} new ${learned.length === 1 ? "technology" : "technologies"} (${learned.slice(0, 6).join(", ")}${learned.length > 6 ? "…" : ""})`);
  if (added.length) bits.push(`${added.length} new ${added.length === 1 ? "entry" : "entries"}`);
  if (changed.length) bits.push(`${changed.length} ${changed.length === 1 ? "field" : "fields"} updated`);

  return {
    at: new Date().toISOString(),
    source: input.source,
    learned,
    added,
    changed,
    summary: bits.length
      ? `Résumé revision picked up ${bits.join(", ")}.`
      : "Résumé revision introduced no changes the site did not already know about.",
  };
}
