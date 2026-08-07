"use client";

import { useEffect } from "react";
import { Page, ArrowLink } from "@/components/ui";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const stale =
    /ChunkLoadError|Loading chunk|is not executable|dynamically imported module/i.test(
      `${error.name}: ${error.message}`,
    );

  useEffect(() => {
    // A stale-chunk failure is not worth showing anyone — it means a new
    // build shipped while this tab was open. ChunkRecovery normally catches
    // it first; this is the backstop for errors that surface through the
    // router instead of window.onerror.
    if (stale) window.location.reload();
  }, [stale]);

  return (
    <Page>
      <div className="py-28">
        <p className="mono mb-4" style={{ color: "var(--dead)" }}>
          {stale ? "stale build" : "error"}
        </p>

        <h1 className="display max-w-[18ch]">
          {stale
            ? "A newer version shipped while you were here."
            : "Something on this page failed."}
        </h1>

        <p className="prose-body mt-5">
          {stale
            ? "Reloading to pick it up. If nothing happens, refresh the page."
            : "The failure is real and this page is not going to pretend otherwise. The rest of the site is unaffected."}
        </p>

        {!stale && (
          <p
            className="mono mt-6 max-w-[70ch] border-l-2 py-1 pl-4"
            style={{ borderColor: "var(--line-bright)", color: "var(--faint)" }}
          >
            {error.message}
            {error.digest && ` · digest ${error.digest}`}
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3">
          <button
            onClick={reset}
            className="mono rounded border px-3 py-1.5"
            style={{ borderColor: "var(--signal)", color: "var(--signal)" }}
          >
            try again
          </button>
          <ArrowLink href="/">Home</ArrowLink>
          <ArrowLink href="/status">Status</ArrowLink>
        </div>
      </div>
    </Page>
  );
}
