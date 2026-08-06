import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { save } from "@/lib/content";

export const dynamic = "force-dynamic";

const EDITABLE = [
  "profile.json",
  "projects.json",
  "decisions.json",
  "timeline.json",
  "skills.json",
  "craft.json",
  "deltas.json",
] as const;

export async function GET() {
  const dir = path.join(process.cwd(), "content");
  const entries = await Promise.all(
    EDITABLE.map(async (file) => {
      try {
        return [file, JSON.parse(await readFile(path.join(dir, file), "utf8"))];
      } catch {
        return [file, null];
      }
    }),
  );
  return NextResponse.json(
    { files: Object.fromEntries(entries) },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function PUT(request: Request) {
  const { file, data } = (await request.json().catch(() => ({}))) as {
    file?: string;
    data?: unknown;
  };

  if (!file || !(EDITABLE as readonly string[]).includes(file)) {
    return NextResponse.json({ error: "unknown file" }, { status: 400 });
  }
  if (data === undefined) {
    return NextResponse.json({ error: "no data" }, { status: 400 });
  }

  try {
    await save(file, data);
    return NextResponse.json({ ok: true, file });
  } catch (err) {
    return NextResponse.json(
      {
        error: `could not write ${file}: ${err instanceof Error ? err.message : "unknown"}`,
        hint: "Serverless filesystems are read-only. Run the admin locally and commit the JSON, or point CONTENT_DIR at a writable volume.",
      },
      { status: 500 },
    );
  }
}
