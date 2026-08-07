import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { span } from "./trace";
import { backend, collection } from "./db";

/* ------------------------------------------------------------------
   CONTENT STORE
   MongoDB when MONGODB_URI is set, JSON files otherwise. Same API
   either way, so pages never learn which one is live — /status says
   so out loud instead.

   Collections seed themselves from content/*.json the first time they
   are read against an empty database, so a fresh Mongo comes up with
   the site already populated rather than blank.
   ------------------------------------------------------------------ */

export type CollectionName =
  | "profile"
  | "skills"
  | "routine"
  | "projects"
  | "decisions"
  | "timeline"
  | "experiments"
  | "deltas";

/** Stored as one document rather than a list. */
export const SINGLETONS = new Set<CollectionName>(["profile", "skills", "routine"]);

/** Which file each collection seeds from, and which field is its id. */
export const COLLECTION_META: Record<
  CollectionName,
  { file: string; idField: string; label: string }
> = {
  profile: { file: "profile.json", idField: "_id", label: "Profile" },
  skills: { file: "skills.json", idField: "_id", label: "Skills" },
  routine: { file: "routine.json", idField: "_id", label: "Routine" },
  projects: { file: "projects.json", idField: "slug", label: "Projects" },
  decisions: { file: "decisions.json", idField: "id", label: "Decisions" },
  timeline: { file: "timeline.json", idField: "org", label: "Experience" },
  experiments: { file: "craft.json", idField: "id", label: "Craft" },
  deltas: { file: "deltas.json", idField: "at", label: "Résumé history" },
};

const CONTENT_DIR = path.join(process.cwd(), "content");

/* ---------------- file mode ---------------- */

async function readJsonFile<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path.join(CONTENT_DIR, file), "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(file: string, data: unknown): Promise<void> {
  await mkdir(CONTENT_DIR, { recursive: true });
  const target = path.join(CONTENT_DIR, file);
  const tmp = `${target}.tmp`;
  await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  const { rename } = await import("node:fs/promises");
  await rename(tmp, target);
}

/* ---------------- seeding ---------------- */

interface SeedState {
  done: Set<string>;
}

function seedState(): SeedState {
  const g = globalThis as unknown as { __seed?: SeedState };
  if (!g.__seed) g.__seed = { done: new Set() };
  return g.__seed;
}

/**
 * Populate an empty Mongo collection from its JSON file. Runs at most
 * once per collection per process, and never overwrites existing rows.
 */
async function seedIfEmpty(name: CollectionName): Promise<void> {
  if (backend() !== "mongodb") return;
  const state = seedState();
  if (state.done.has(name)) return;
  state.done.add(name);

  try {
    const col = await collection(name);
    if ((await col.estimatedDocumentCount()) > 0) return;

    const meta = COLLECTION_META[name];
    if (SINGLETONS.has(name)) {
      const doc = await readJsonFile<Record<string, unknown> | null>(meta.file, null);
      if (doc) await col.insertOne({ ...doc, _singleton: true });
    } else {
      const rows = await readJsonFile<Record<string, unknown>[]>(meta.file, []);
      if (rows.length)
        await col.insertMany(rows.map((r, i) => ({ ...r, _order: i })));
    }
  } catch {
    // A seed failure must never take a page down; the read below will
    // simply return whatever is there (possibly nothing).
  }
}

function strip<T>(doc: Record<string, unknown> | null): T | null {
  if (!doc) return null;
  const { _id, _order, _singleton, ...rest } = doc;
  void _id;
  void _order;
  void _singleton;
  return rest as T;
}

/* ---------------- reads ---------------- */

export async function readList<T>(name: CollectionName): Promise<T[]> {
  const meta = COLLECTION_META[name];
  return span(
    `store.list ${name} (${backend()})`,
    backend() === "mongodb" ? "net" : "io",
    async () => {
      if (backend() === "mongodb") {
        try {
          await seedIfEmpty(name);
          const col = await collection(name);
          const rows = await col.find({}).sort({ _order: 1 }).toArray();
          return rows.map((r) => strip<T>(r as Record<string, unknown>)!);
        } catch {
          // Fall through to the files rather than serving an empty site.
          return readJsonFile<T[]>(meta.file, []);
        }
      }
      return readJsonFile<T[]>(meta.file, []);
    },
  );
}

export async function readSingleton<T>(
  name: CollectionName,
  fallback: T,
): Promise<T> {
  const meta = COLLECTION_META[name];
  return span(
    `store.get ${name} (${backend()})`,
    backend() === "mongodb" ? "net" : "io",
    async () => {
      if (backend() === "mongodb") {
        try {
          await seedIfEmpty(name);
          const col = await collection(name);
          const doc = await col.findOne({});
          const value = strip<T>(doc as Record<string, unknown> | null);
          if (value) return value;
        } catch {
          /* fall through */
        }
      }
      return readJsonFile<T>(meta.file, fallback);
    },
  );
}

/* ---------------- writes ---------------- */

export async function saveSingleton(
  name: CollectionName,
  doc: Record<string, unknown>,
): Promise<void> {
  if (backend() === "mongodb") {
    const col = await collection(name);
    await col.updateOne({}, { $set: { ...doc, _singleton: true } }, { upsert: true });
    return;
  }
  await writeJsonFile(COLLECTION_META[name].file, doc);
}

export async function upsertRecord(
  name: CollectionName,
  id: string,
  doc: Record<string, unknown>,
): Promise<void> {
  const { idField } = COLLECTION_META[name];

  if (backend() === "mongodb") {
    const col = await collection(name);
    const existing = await col.findOne({ [idField]: id });
    const order =
      (existing?._order as number | undefined) ??
      (await col.estimatedDocumentCount());
    await col.updateOne(
      { [idField]: id },
      { $set: { ...doc, _order: order } },
      { upsert: true },
    );
    return;
  }

  const rows = await readJsonFile<Record<string, unknown>[]>(
    COLLECTION_META[name].file,
    [],
  );
  const index = rows.findIndex((r) => String(r[idField]) === id);
  if (index >= 0) rows[index] = doc;
  else rows.push(doc);
  await writeJsonFile(COLLECTION_META[name].file, rows);
}

export async function deleteRecord(name: CollectionName, id: string): Promise<void> {
  const { idField } = COLLECTION_META[name];

  if (backend() === "mongodb") {
    const col = await collection(name);
    await col.deleteOne({ [idField]: id });
    return;
  }

  const rows = await readJsonFile<Record<string, unknown>[]>(
    COLLECTION_META[name].file,
    [],
  );
  await writeJsonFile(
    COLLECTION_META[name].file,
    rows.filter((r) => String(r[idField]) !== id),
  );
}

export async function replaceList(
  name: CollectionName,
  rows: Record<string, unknown>[],
): Promise<void> {
  if (backend() === "mongodb") {
    const col = await collection(name);
    await col.deleteMany({});
    if (rows.length) await col.insertMany(rows.map((r, i) => ({ ...r, _order: i })));
    return;
  }
  await writeJsonFile(COLLECTION_META[name].file, rows);
}

/** Move a record up or down in display order. */
export async function reorder(
  name: CollectionName,
  id: string,
  direction: -1 | 1,
): Promise<void> {
  const { idField } = COLLECTION_META[name];
  const rows = await readList<Record<string, unknown>>(name);
  const index = rows.findIndex((r) => String(r[idField]) === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= rows.length) return;
  [rows[index], rows[target]] = [rows[target], rows[index]];
  await replaceList(name, rows);
}

/* ---------------- migration ---------------- */

export interface MigrationReport {
  backend: string;
  collections: { name: string; before: number; after: number; seeded: boolean }[];
}

/** Explicit one-shot import of every JSON file into Mongo. */
export async function migrateFilesToMongo(
  overwrite = false,
): Promise<MigrationReport> {
  if (backend() !== "mongodb")
    throw new Error("MONGODB_URI is not set — nothing to migrate into");

  const report: MigrationReport["collections"] = [];

  for (const name of Object.keys(COLLECTION_META) as CollectionName[]) {
    const meta = COLLECTION_META[name];
    const col = await collection(name);
    const before = await col.estimatedDocumentCount();

    if (before > 0 && !overwrite) {
      report.push({ name, before, after: before, seeded: false });
      continue;
    }
    if (overwrite) await col.deleteMany({});

    if (SINGLETONS.has(name)) {
      const doc = await readJsonFile<Record<string, unknown> | null>(meta.file, null);
      if (doc) await col.insertOne({ ...doc, _singleton: true });
    } else {
      const rows = await readJsonFile<Record<string, unknown>[]>(meta.file, []);
      if (rows.length) await col.insertMany(rows.map((r, i) => ({ ...r, _order: i })));
    }

    report.push({
      name,
      before,
      after: await col.estimatedDocumentCount(),
      seeded: true,
    });
  }

  seedState().done.clear();
  return { backend: backend(), collections: report };
}

/** Export everything back out, for backup or for committing to git. */
export async function exportAll(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const name of Object.keys(COLLECTION_META) as CollectionName[]) {
    out[COLLECTION_META[name].file] = SINGLETONS.has(name)
      ? await readSingleton(name, {})
      : await readList(name);
  }
  return out;
}
