import type { Metadata } from "next";
import { markRoute } from "@/lib/trace";
import { buildCorpus } from "@/lib/retrieval";
import { buildGraph, graphStats } from "@/lib/graph";
import { getDeltas } from "@/lib/content";
import { ASK_LIMIT, DAILY_BUDGET_USD } from "@/lib/ratelimit";
import { Page, PageHead, Stat } from "@/components/ui";
import { AskConsole } from "@/components/ask-console";

export const metadata: Metadata = {
  title: "Ask",
  description:
    "A retrieval console over this site's own corpus. Hybrid BM25 plus knowledge-graph expansion, with every passage, score and cost shown.",
  alternates: { canonical: "/ask" },
};

export default async function AskPage() {
  markRoute("/ask");
  const [corpus, graph, deltas] = await Promise.all([
    buildCorpus(),
    buildGraph(),
    getDeltas(),
  ]);
  const stats = graphStats(graph);
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const recentlyLearned = deltas[0]?.learned ?? [];

  return (
    <Page>
      <PageHead
        label="ask"
        title="Interrogate the corpus."
        lede="BM25 over everything on this site, then one hop through the knowledge graph for recall. It shows you the passages it used, the score for each, which half of the retrieval found them, and what the answer cost."
        aside={
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-1 lg:gap-4">
            <Stat value={String(corpus.length)} label="chunks indexed" tone="signal" />
            <Stat value={String(stats.nodes)} label="graph entities" />
            <Stat value={hasKey ? "synthesis" : "extractive"} label="mode" />
            <Stat value={`${ASK_LIMIT.capacity}/hr`} label="rate limit" />
          </div>
        }
      />

      <section className="py-10">
        <AskConsole recentlyLearned={recentlyLearned} />
      </section>

      <section className="hairline grid gap-x-12 gap-y-4 py-10 md:grid-cols-[10rem_1fr]">
        <h2 className="mono" style={{ color: "var(--faint)" }}>
          how it works
        </h2>
        <div className="prose-body">
          <p>
            The corpus is derived from the same JSON that renders every other page, at
            request time — there is no second copy to drift out of date. Chunks are
            tokenised, stopworded and scored with BM25 (k₁ = 1.5, b = 0.75). The
            per-term contributions under each result are the real scoring terms.
          </p>
          <p>
            Then the query is matched against the{" "}
            <a href="/graph">knowledge graph</a> and expanded by one hop. Ask about
            Qdrant and you reach every project that used it, even the ones whose text
            never repeats the word. Graph-expanded passages are damped so lexical
            evidence still wins, and they are labelled so you can tell them apart.
          </p>
          <p>
            {hasKey
              ? `An API key is configured, so the top passages go to Claude under a system prompt that forbids any claim not present in them. Synthesis costs money, so it is capped at ${ASK_LIMIT.capacity} answers per hour per visitor and $${DAILY_BUDGET_USD.toFixed(2)} a day overall. Retrieval is local and free, so it is never limited — when the budget runs out you still get exact passages, just no prose.`
              : "No API key is configured, so nothing is generated. Answers are assembled from sentences lifted verbatim out of the retrieved passages — unhelpful is possible, hallucination is not."}
          </p>
          <p>
            Ask it something the site doesn&rsquo;t cover and watch it say so. A
            retrieval system that can&rsquo;t refuse isn&rsquo;t trustworthy on the
            questions it can answer.
          </p>
        </div>
      </section>
    </Page>
  );
}
