import { NextResponse } from "next/server";
import {
  deleteRecord,
  readList,
  readSingleton,
  reorder,
  saveSingleton,
  upsertRecord,
  SINGLETONS,
  type CollectionName,
} from "@/lib/store";
import { schemaFor } from "@/lib/admin-schema";
import { backend, pingDb } from "@/lib/db";

export const dynamic = "force-dynamic";

function resolve(request: Request) {
  const name = new URL(request.url).searchParams.get("collection") ?? "";
  const schema = schemaFor(name);
  return { name: name as CollectionName, schema };
}

export async function GET(request: Request) {
  const { name, schema } = resolve(request);
  if (!schema)
    return NextResponse.json({ error: "unknown collection" }, { status: 400 });

  const data = schema.singleton
    ? await readSingleton<Record<string, unknown>>(name, {})
    : await readList<Record<string, unknown>>(name);

  return NextResponse.json(
    { collection: name, singleton: schema.singleton, data, backend: backend(), health: await pingDb() },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function PUT(request: Request) {
  const { name, schema } = resolve(request);
  if (!schema)
    return NextResponse.json({ error: "unknown collection" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as {
    record?: Record<string, unknown>;
    previousId?: string;
  };
  const record = body.record;
  if (!record) return NextResponse.json({ error: "no record" }, { status: 400 });

  try {
    if (schema.singleton || SINGLETONS.has(name)) {
      await saveSingleton(name, record);
      return NextResponse.json({ ok: true });
    }

    const id = String(record[schema.idField] ?? "").trim();
    if (!id)
      return NextResponse.json(
        { error: `${schema.idField} is required` },
        { status: 400 },
      );

    // Renaming the id means the old row has to go, or you get a duplicate.
    if (body.previousId && body.previousId !== id) {
      await deleteRecord(name, body.previousId);
    }

    await upsertRecord(name, id, record);
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "write failed",
        hint: "If this is a serverless host, the filesystem is read-only — set MONGODB_URI or run the admin locally.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const { name, schema } = resolve(request);
  const id = new URL(request.url).searchParams.get("id");
  if (!schema || !id)
    return NextResponse.json({ error: "collection and id required" }, { status: 400 });

  await deleteRecord(name, id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const { name, schema } = resolve(request);
  if (!schema)
    return NextResponse.json({ error: "unknown collection" }, { status: 400 });

  const { id, direction } = (await request.json().catch(() => ({}))) as {
    id?: string;
    direction?: number;
  };
  if (!id || (direction !== 1 && direction !== -1))
    return NextResponse.json({ error: "id and direction required" }, { status: 400 });

  await reorder(name, id, direction);
  return NextResponse.json({ ok: true });
}
