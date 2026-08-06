import Link from "next/link";
import { getFeed, getProfile, type FeedKind } from "@/lib/content";
import { markRoute, span } from "@/lib/trace";
import { Page, Tag, ArrowLink } from "@/components/ui";

const KIND_LABEL: Record<FeedKind, string> = {
  ship: "shipped",
  decide: "decided",
  learn: "learned",
  craft: "built",
  role: "joined",
};

const KIND_TONE: Record<FeedKind, "dim" | "signal" | "dead"> = {
  ship: "signal",
  decide: "dim",
  learn: "signal",
  craft: "dim",
  role: "dim",
};

function year(date: string): string {
  return date.slice(0, 4);
}

export default async function HomePage() {
  markRoute("/");
  const [profile, feed] = await Promise.all([getProfile(), getFeed()]);
  const grouped = await span("feed.group-by-year", "compute", () => {
    const map = new Map<string, typeof feed>();
    for (const item of feed) {
      const y = year(item.date);
      map.set(y, [...(map.get(y) ?? []), item]);
    }
    return [...map.entries()];
  });

  return (
    <Page>
      {/* ---------------- hero ---------------- */}
      <section className="reveal border-b py-16 sm:py-24" style={{ borderColor: "var(--line)" }}>
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <span className="pulse-dot" aria-hidden />
          <span className="mono" style={{ color: "var(--signal)" }}>
            {profile.availability}
          </span>
          <span className="mono" style={{ color: "var(--faint)" }}>
            {profile.role} · {profile.location}
          </span>
        </div>

        <h1 className="display max-w-[19ch]">
          I build the parts of systems that have to keep working when nobody is
          watching.
        </h1>

        <p className="prose-body mt-6">
          Lately that means retrieval and inference pipelines that need the same
          operational rigour as any other backend — evaluated, instrumented, and
          honest about what they can&rsquo;t do.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3">
          <ArrowLink href="/work">See the work</ArrowLink>
          <ArrowLink href="/ask">Ask this site a question</ArrowLink>
          <ArrowLink href="/graveyard">Read what failed</ArrowLink>
        </div>
      </section>

      {/* ---------------- the thesis ---------------- */}
      <section className="border-b py-10" style={{ borderColor: "var(--line)" }}>
        <div className="grid gap-6 md:grid-cols-[minmax(0,26rem)_1fr] md:gap-12">
          <p className="mono" style={{ color: "var(--faint)" }}>
            about this site
          </p>
          <div className="prose-body">
            <p>
              A CV asserts things. This one tries to only claim what you can check
              from where you&rsquo;re standing. The bar pinned to the bottom of your
              screen is reading the actual server spans for the request that rendered
              this page — press{" "}
              <kbd
                className="mono rounded border px-1.5 py-0.5"
                style={{ borderColor: "var(--line-bright)", color: "var(--ink)" }}
              >
                T
              </kbd>{" "}
              to open the waterfall.{" "}
              <Link href="/status">/status</Link> computes its percentiles from the
              last 250 requests this instance served, including yours.{" "}
              <Link href="/ask">/ask</Link> shows you every chunk it retrieved and the
              score it gave each one, so you can tell when it&rsquo;s guessing.
            </p>
            <p>
              Nothing here is a mock. Where a number cannot be measured honestly, it
              isn&rsquo;t shown.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------- the changelog ---------------- */}
      <section className="py-12">
        <div className="mb-6 flex items-baseline justify-between gap-4">
          <h2 className="mono" style={{ color: "var(--faint)" }}>
            everything, newest first
          </h2>
          <span className="mono" style={{ color: "var(--faint)" }}>
            {feed.length} entries
          </span>
        </div>

        {grouped.map(([y, items]) => (
          <div key={y} className="grid gap-x-10 border-t py-2 md:grid-cols-[5rem_1fr]" style={{ borderColor: "var(--line)" }}>
            <p className="num sticky top-24 self-start py-4 text-[13px]" style={{ color: "var(--faint)" }}>
              {y}
            </p>
            <div>
              {items.map((item, i) => {
                const inner = (
                  <div className="grid gap-1 py-4 pl-4 sm:grid-cols-[6.5rem_1fr] sm:gap-4">
                    <div className="pt-0.5">
                      <Tag tone={KIND_TONE[item.kind]}>{KIND_LABEL[item.kind]}</Tag>
                    </div>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-baseline gap-x-3 text-[15px] font-medium">
                        {item.title}
                        {item.meta && (
                          <span className="mono font-normal" style={{ color: "var(--faint)" }}>
                            {item.meta}
                          </span>
                        )}
                      </p>
                      <p className="mt-1 max-w-[68ch] text-[14px]" style={{ color: "var(--dim)" }}>
                        {item.detail}
                      </p>
                    </div>
                  </div>
                );

                return item.href ? (
                  <Link
                    key={`${item.title}-${i}`}
                    href={item.href}
                    className="row block border-b last:border-b-0"
                    style={{ borderColor: "var(--line)" }}
                  >
                    {inner}
                  </Link>
                ) : (
                  <div
                    key={`${item.title}-${i}`}
                    className="row block border-b last:border-b-0"
                    style={{ borderColor: "var(--line)" }}
                  >
                    {inner}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </Page>
  );
}
