import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pingDb, backend } from "@/lib/db";
import { cacheStats } from "@/lib/semantic-cache";

export const dynamic = "force-dynamic";

/** Each check does actual work and reports what it actually cost. */
async function check(
  name: string,
  fn: () => Promise<unknown>,
  optional = false,
) {
  const t0 = performance.now();
  try {
    await fn();
    return { name, ok: true, optional, ms: performance.now() - t0, error: null };
  } catch (err) {
    return {
      name,
      ok: false,
      optional,
      ms: performance.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function GET() {
  const checks = await Promise.all([
    check("content.disk", () =>
      readFile(path.join(process.cwd(), "content", "projects.json"), "utf8"),
    ),
    check("json.parse", async () => {
      const raw = await readFile(
        path.join(process.cwd(), "content", "decisions.json"),
        "utf8",
      );
      return JSON.parse(raw);
    }),
    check("compute.hash", async () => {
      let acc = 0;
      for (let i = 0; i < 250_000; i++) acc = (acc * 31 + i) % 2147483647;
      return acc;
    }),
    // Optional by design: /ask degrades to extractive retrieval without it,
    // which is a different mode, not an outage.
    check(
      "llm.credential",
      async () => {
        if (!process.env.ANTHROPIC_API_KEY)
          throw new Error("no key configured — /ask answers extractively");
        return true;
      },
      true,
    ),
    check(
      `store.${backend()}`,
      async () => {
        const db = await pingDb();
        if (!db.ok) throw new Error(db.detail);
        return db;
      },
      // Whichever backend is live, a failure here is a real failure.
      false,
    ),
  ]);

  const failed = checks.filter((c) => !c.ok && !c.optional).map((c) => c.name);
  const unconfigured = checks.filter((c) => !c.ok && c.optional).map((c) => c.name);

  return NextResponse.json(
    {
      status: failed.length === 0 ? "ok" : "degraded",
      degraded: failed,
      unconfigured,
      checks,
      store: await pingDb(),
      cache: cacheStats(),
      uptimeSeconds: Math.round(process.uptime()),
      node: process.version,
      at: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
