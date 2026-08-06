import { cache } from "react";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { span } from "./trace";
import type { Routine } from "./routine-core";

export * from "./routine-core";

export const getRoutine = cache(async (): Promise<Routine> => {
  return span("fs.read content/routine.json", "io", async () => {
    const raw = await readFile(
      path.join(process.cwd(), "content", "routine.json"),
      "utf8",
    );
    return JSON.parse(raw) as Routine;
  });
});
