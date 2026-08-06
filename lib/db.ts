import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { span } from "./trace";

/* ------------------------------------------------------------------
   Storage.
   MongoDB when MONGODB_URI is set, a JSON file store otherwise. The
   site works either way, and /status says which one is actually live
   rather than implying a database that isn't there.
   ------------------------------------------------------------------ */

export type Backend = "mongodb" | "file";

export function backend(): Backend {
  return process.env.MONGODB_URI ? "mongodb" : "file";
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_NAME = process.env.MONGODB_DB ?? "portfolio";

/* ---------------- mongo, lazily and once ---------------- */

interface MongoCache {
  client: import("mongodb").MongoClient | null;
  promise: Promise<import("mongodb").MongoClient> | null;
}

function mongoCache(): MongoCache {
  const g = globalThis as unknown as { __mongo?: MongoCache };
  if (!g.__mongo) g.__mongo = { client: null, promise: null };
  return g.__mongo;
}

async function mongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");

  const cache = mongoCache();
  if (cache.client) return cache.client;
  if (!cache.promise) {
    const { MongoClient } = await import("mongodb");
    cache.promise = new MongoClient(uri, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 6000,
    }).connect();
  }
  cache.client = await cache.promise;
  return cache.client;
}

export async function collection<T extends Document = Document>(name: string) {
  const client = await mongo();
  return client.db(DB_NAME).collection<T>(name);
}

/* ---------------- file store ---------------- */

async function readFileStore<T>(name: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(path.join(DATA_DIR, `${name}.json`), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeFileStore(name: string, data: unknown): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(
    path.join(DATA_DIR, `${name}.json`),
    `${JSON.stringify(data, null, 2)}\n`,
    "utf8",
  );
}

/* ---------------- the repository ---------------- */

export interface CheckIn {
  /** YYYY-MM-DD in the routine's timezone */
  date: string;
  blockId: string;
  status: "done" | "partial" | "skipped";
  minutes?: number;
  note?: string;
  at: string;
}

/**
 * Reads every check-in on or after `since`. Small dataset by design —
 * one document per block per day, so a year is a few thousand rows.
 */
export async function readCheckIns(since: string): Promise<CheckIn[]> {
  return span(
    `db.read checkins (${backend()})`,
    backend() === "mongodb" ? "net" : "io",
    async () => {
      if (backend() === "mongodb") {
        try {
          const col = await collection<CheckIn & Document>("checkins");
          const rows = await col
            .find({ date: { $gte: since } }, { projection: { _id: 0 } })
            .sort({ date: -1 })
            .limit(4000)
            .toArray();
          return rows as unknown as CheckIn[];
        } catch {
          // A database that is unreachable should degrade to empty, not 500.
          return [];
        }
      }
      const all = await readFileStore<CheckIn[]>("checkins", []);
      return all.filter((c) => c.date >= since);
    },
  );
}

export async function writeCheckIn(entry: CheckIn): Promise<void> {
  if (backend() === "mongodb") {
    const col = await collection<CheckIn & Document>("checkins");
    await col.updateOne(
      { date: entry.date, blockId: entry.blockId },
      { $set: { ...entry } as Document },
      { upsert: true },
    );
    return;
  }
  const all = await readFileStore<CheckIn[]>("checkins", []);
  const next = all.filter((c) => !(c.date === entry.date && c.blockId === entry.blockId));
  next.unshift(entry);
  await writeFileStore("checkins", next.slice(0, 8000));
}

export async function deleteCheckIn(date: string, blockId: string): Promise<void> {
  if (backend() === "mongodb") {
    const col = await collection<CheckIn & Document>("checkins");
    await col.deleteOne({ date, blockId });
    return;
  }
  const all = await readFileStore<CheckIn[]>("checkins", []);
  await writeFileStore(
    "checkins",
    all.filter((c) => !(c.date === date && c.blockId === blockId)),
  );
}

export interface DbHealth {
  backend: Backend;
  ok: boolean;
  latencyMs: number;
  detail: string;
}

export async function pingDb(): Promise<DbHealth> {
  const t0 = performance.now();
  if (backend() === "file") {
    const rows = await readFileStore<CheckIn[]>("checkins", []);
    return {
      backend: "file",
      ok: true,
      latencyMs: performance.now() - t0,
      detail: `JSON file store · ${rows.length} check-ins · set MONGODB_URI to switch`,
    };
  }
  try {
    const client = await mongo();
    await client.db(DB_NAME).command({ ping: 1 });
    return {
      backend: "mongodb",
      ok: true,
      latencyMs: performance.now() - t0,
      detail: `connected to ${DB_NAME}`,
    };
  } catch (err) {
    return {
      backend: "mongodb",
      ok: false,
      latencyMs: performance.now() - t0,
      detail: err instanceof Error ? err.message.slice(0, 140) : "unreachable",
    };
  }
}

// `Document` is Mongo's loose row type; declared here so the file store
// path doesn't need the driver imported at module scope.
type Document = Record<string, unknown>;
