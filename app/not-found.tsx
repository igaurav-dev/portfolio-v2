import { Page, ArrowLink } from "@/components/ui";

export default function NotFound() {
  return (
    <Page>
      <div className="py-28">
        <p className="mono mb-4" style={{ color: "var(--dead)" }}>
          404
        </p>
        <h1 className="display max-w-[16ch]">This route was never registered.</h1>
        <p className="prose-body mt-5">
          Which is at least an honest failure. Press{" "}
          <kbd className="mono rounded border px-1.5 py-0.5" style={{ borderColor: "var(--line-bright)", color: "var(--ink)" }}>
            ⌘K
          </kbd>{" "}
          for everything that does exist.
        </p>
        <div className="mt-8 flex flex-wrap gap-x-7 gap-y-3">
          <ArrowLink href="/">Home</ArrowLink>
          <ArrowLink href="/work">Work</ArrowLink>
        </div>
      </div>
    </Page>
  );
}
