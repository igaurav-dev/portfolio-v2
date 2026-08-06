import { NextResponse } from "next/server";
import { listUploads, saveUpload } from "@/lib/resume";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BYTES = 8 * 1024 * 1024;

export async function GET() {
  return NextResponse.json(
    { uploads: await listUploads() },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no file in the request" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `file is ${(file.size / 1024 / 1024).toFixed(1)}MB — the limit is 8MB` },
      { status: 413 },
    );
  }
  if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "only PDFs are supported" }, { status: 415 });
  }

  try {
    const stored = await saveUpload(
      file.name,
      new Uint8Array(await file.arrayBuffer()),
    );
    return NextResponse.json({ ok: true, upload: stored });
  } catch (err) {
    return NextResponse.json(
      {
        error: `could not store the file: ${err instanceof Error ? err.message : "unknown"}`,
        hint: "Serverless filesystems are read-only outside /tmp. Run this locally or mount a volume.",
      },
      { status: 500 },
    );
  }
}
