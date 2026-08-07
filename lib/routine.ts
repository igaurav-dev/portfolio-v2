import { cache } from "react";
import type { Routine } from "./routine-core";
import { readSingleton } from "./store";

export * from "./routine-core";

const FALLBACK: Routine = { timezone: "Asia/Kolkata", label: "Routine", blocks: [] };

export const getRoutine = cache((): Promise<Routine> =>
  readSingleton<Routine>("routine", FALLBACK),
);
