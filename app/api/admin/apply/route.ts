import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { save, type ResumeDelta } from "@/lib/content";
import type { Extraction } from "@/lib/resume";

export const dynamic = "force-dynamic";

type Section = "profile" | "skills" | "timeline" | "projects" | "delta";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    extraction?: Extraction;
    delta?: ResumeDelta;
    sections?: Section[];
  };

  const { extraction, delta } = body;
  const sections = new Set(body.sections ?? []);
  if (!extraction) return NextResponse.json({ error: "no extraction" }, { status: 400 });

  const dir = path.join(process.cwd(), "content");
  const readJson = async <T>(file: string, fallback: T): Promise<T> => {
    try {
      return JSON.parse(await readFile(path.join(dir, file), "utf8")) as T;
    } catch {
      return fallback;
    }
  };

  const written: string[] = [];

  try {
    if (sections.has("profile") && extraction.profile) {
      const current = await readJson<Record<string, unknown>>("profile.json", {});
      // Merge: extraction wins only where it actually produced a value.
      const merged = { ...current };
      for (const [k, v] of Object.entries(extraction.profile)) {
        if (v !== undefined && v !== null && `${v}`.trim() !== "") merged[k] = v;
      }
      await save("profile.json", merged);
      written.push("profile.json");
    }

    if (sections.has("skills") && extraction.skills) {
      await save("skills.json", extraction.skills);
      written.push("skills.json");
    }

    if (sections.has("timeline") && extraction.timeline?.length) {
      await save("timeline.json", extraction.timeline);
      written.push("timeline.json");
    }

    if (sections.has("projects") && extraction.projects?.length) {
      const current = await readJson<Record<string, unknown>[]>("projects.json", []);
      const bySlug = new Map(current.map((p) => [String(p.slug), p]));

      for (const incoming of extraction.projects) {
        if (!incoming.slug) continue;
        const existing = bySlug.get(incoming.slug) ?? {};
        const populated = Object.fromEntries(
          Object.entries(incoming).filter(([, v]) =>
            Array.isArray(v)
              ? v.length > 0
              : v !== undefined && v !== null && `${v}`.trim() !== "",
          ),
        );

        // Narrative fields are hand-written and must survive an extraction.
        const merged: Record<string, unknown> = {
          duration: "",
          status: "in production",
          kind: "company",
          role: "",
          problem: "",
          approach: [],
          metrics: [],
          links: [],
          ...existing,
          ...populated,
        };
        merged.tradeoffs = existing.tradeoffs ?? "";
        merged.wentWrong = existing.wentWrong ?? "";

        bySlug.set(incoming.slug, merged);
      }
      await save("projects.json", [...bySlug.values()]);
      written.push("projects.json");
    }

    if (sections.has("delta") && delta) {
      const current = await readJson<ResumeDelta[]>("deltas.json", []);
      await save("deltas.json", [delta, ...current].slice(0, 40));
      written.push("deltas.json");
    }

    return NextResponse.json({ ok: true, written });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "write failed",
        written,
        hint: "Serverless filesystems are read-only. Run the admin locally and commit the result.",
      },
      { status: 500 },
    );
  }
}
