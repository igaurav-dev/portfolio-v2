"use client";

import { useEffect } from "react";

/* ------------------------------------------------------------------
   CHUNK RECOVERY

   Next.js fingerprints every JS chunk with a content hash. When a new
   build is deployed, the old hashes stop existing — but a browser that
   loaded the page before the deploy still holds the old HTML, and the
   moment it navigates it asks for a chunk that is gone. The server
   answers with its HTML 404 page, the browser refuses to execute HTML
   as JavaScript, and the route dies with:

     ChunkLoadError: Loading chunk 9557 failed
     Refused to execute script … MIME type ('text/html') is not executable

   There is no way to prevent this without keeping every build's assets
   forever. The correct response is to reload once and pick up the new
   HTML. The sessionStorage guard means a genuinely broken deploy shows
   the real error instead of reloading forever.
   ------------------------------------------------------------------ */

const GUARD = "chunk-reload-at";
const COOLDOWN_MS = 20_000;

function isChunkError(message: string): boolean {
  return (
    /ChunkLoadError/i.test(message) ||
    /Loading chunk \S+ failed/i.test(message) ||
    /Loading CSS chunk/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /'text\/html' is not executable/i.test(message) ||
    /Importing a module script failed/i.test(message)
  );
}

function recover(message: string): void {
  if (!isChunkError(message)) return;

  try {
    const last = Number(sessionStorage.getItem(GUARD) ?? 0);
    // Already tried recently — this is not a stale deploy, it is broken.
    if (Date.now() - last < COOLDOWN_MS) return;
    sessionStorage.setItem(GUARD, String(Date.now()));
  } catch {
    // Private mode with no storage: reloading once is still better than
    // leaving the visitor on a dead page.
  }

  window.location.reload();
}

export function ChunkRecovery() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      recover(event.message || String(event.error ?? ""));
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      recover(
        reason instanceof Error
          ? `${reason.name}: ${reason.message}`
          : String(reason ?? ""),
      );
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
