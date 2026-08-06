import { NextResponse } from "next/server";
import { extractFromPdf, readUpload, diffResume } from "@/lib/resume";
import {
  getProfile,
  getProjects,
  getSkills,
  getTimeline,
} from "@/lib/content";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "no upload id" }, { status: 400 });

  const started = performance.now();

  try {
    const pdf = await readUpload(id);
    const extraction = await extractFromPdf(pdf);
    const extractMs = performance.now() - started;

    const [currentProfile, currentProjects, currentSkills, currentTimeline] =
      await Promise.all([getProfile(), getProjects(), getSkills(), getTimeline()]);

    const delta = diffResume({
      extraction,
      currentProfile,
      currentProjects,
      currentSkills,
      currentTimeline,
      source: id.replace(/^\d+-/, ""),
    });

    return NextResponse.json({
      ok: true,
      extraction,
      delta,
      stats: {
        extractMs,
        projects: extraction.projects?.length ?? 0,
        roles: extraction.timeline?.length ?? 0,
        skillCategories: Object.keys(extraction.skills ?? {}).length,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "extraction failed" },
      { status: 500 },
    );
  }
}
