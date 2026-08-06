"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface HitView {
  rank: number;
  id: string;
  source: string;
  href: string;
  score: number;
  via: "bm25" | "graph";
  expandedFrom: string | null;
  terms: { term: string; contribution: number }[];
  preview: string;
}

interface CacheInfo {
  hit: boolean;
  similarity?: number;
  matchedQuestion?: string;
  reuseCount?: number;
  savedUsd?: number;
  stats: {
    entries: number;
    hits: number;
    misses: number;
    hitRate: number;
    savedUsd: number;
    threshold: number;
    persisted: boolean;
  };
}

interface AskResult {
  answer: string;
  mode: "synthesised" | "extractive" | "cached";
  warning: string | null;
  usage: { input: number; output: number } | null;
  costUsd: number;
  quota: { remaining: number; capacity: number; resetInMs: number };
  budget: { spentUsd: number; budgetUsd: number; exhausted: boolean };
  retrieval: { lexical: number; expanded: number; seeds: string[] };
  cache: CacheInfo;
  context: { kept: number; droppedDuplicate: number; droppedBudget: number; chars: number } | null;
  timings: { retrieveMs: number; synthesiseMs: number; totalMs: number };
  hits: HitView[];
}

interface Quota {
  remaining: number;
  capacity: number;
  resetInMs: number;
  synthesisEnabled: boolean;
  budget: { spentUsd: number; budgetUsd: number; exhausted: boolean };
  cache: CacheInfo["stats"];
}

const SUGGESTED = [
  "What has he built with Qdrant?",
  "Why did he choose APIM policies over Azure Functions?",
  "What has he learned most recently?",
  "Does he have experience with Azure OpenAI?",
  "How does he keep a RAG system from hallucinating?",
  "What trade-offs has he accepted, and why?",
];

export function AskConsole({ recentlyLearned = [] }: { recentlyLearned?: string[] }) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/ask", { cache: "no-store" });
        if (res.ok) setQuota(await res.json());
      } catch {
        /* the meter is informational */
      }
    })();
  }, []);

  const ask = async (q: string) => {
    if (!q.trim() || loading) return;
    setLoading(true);
    setError(null);
    setQuestion(q);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "request failed");
      setResult(data as AskResult);
      setQuota((q) =>
        q
          ? {
              ...q,
              remaining: data.quota.remaining,
              budget: data.budget,
              cache: data.cache?.stats ?? q.cache,
            }
          : q,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "something broke");
    } finally {
      setLoading(false);
    }
  };

  const pct = quota ? (quota.remaining / quota.capacity) * 100 : 100;

  return (
    <div>
      {quota && (
        <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="mono flex items-center gap-2" style={{ color: "var(--faint)" }}>
            <span className="pulse-dot" aria-hidden />
            {quota.synthesisEnabled ? "synthesis on" : "extractive only"}
          </span>
          <span className="flex items-center gap-2">
            <span
              className="h-1.5 w-20 overflow-hidden rounded-full"
              style={{ background: "var(--raised)" }}
            >
              <span
                className="block h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  background: pct < 30 ? "var(--dead)" : "var(--signal)",
                }}
              />
            </span>
            <span className="mono" style={{ color: "var(--faint)" }}>
              {quota.remaining}/{quota.capacity} synthesised answers left this hour
            </span>
          </span>
          {quota.synthesisEnabled && (
            <span className="mono" style={{ color: "var(--faint)" }}>
              daily budget ${quota.budget.spentUsd.toFixed(4)} / $
              {quota.budget.budgetUsd.toFixed(2)}
            </span>
          )}
          {quota.cache && (
            <span className="mono" style={{ color: "var(--faint)" }}>
              cache {quota.cache.entries} questions ·{" "}
              {(quota.cache.hitRate * 100).toFixed(0)}% reuse
              {quota.cache.savedUsd > 0 && ` · $${quota.cache.savedUsd.toFixed(4)} saved`}
            </span>
          )}
        </div>
      )}

      {recentlyLearned.length > 0 && (
        <div className="mb-5 border-l-2 py-2 pl-4" style={{ borderColor: "var(--signal)" }}>
          <p className="mono mb-2" style={{ color: "var(--signal)" }}>
            newest since the last résumé
          </p>
          <div className="flex flex-wrap gap-1.5">
            {recentlyLearned.slice(0, 12).map((item) => (
              <button
                key={item}
                onClick={() => void ask(`What has he done with ${item}?`)}
                className="mono rounded border px-1.5 py-0.5 transition-colors"
                style={{ borderColor: "var(--line-bright)", color: "var(--dim)" }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
        className="panel flex items-center gap-3 px-4 py-3"
        style={{ borderColor: loading ? "var(--signal)" : "var(--line-bright)" }}
      >
        <span className="mono shrink-0" style={{ color: "var(--signal)" }}>
          ?
        </span>
        <input
          ref={inputRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask anything the site can actually support…"
          maxLength={500}
          className="w-full bg-transparent text-[15px] outline-none"
          style={{ color: "var(--ink)" }}
          aria-label="Question"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="mono shrink-0 rounded border px-2.5 py-1 transition-opacity disabled:opacity-35"
          style={{ borderColor: "var(--line-bright)", color: "var(--ink)" }}
        >
          {loading ? "retrieving" : "ask"}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTED.map((s) => (
          <button
            key={s}
            onClick={() => void ask(s)}
            className="rounded-full border px-3 py-1 text-[12.5px] transition-colors"
            style={{ borderColor: "var(--line)", color: "var(--dim)" }}
          >
            {s}
          </button>
        ))}
      </div>

      {loading && (
        <div className="panel mt-6 overflow-hidden">
          <div className="scan h-[2px] w-1/3" aria-hidden />
          <p className="mono px-4 py-6" style={{ color: "var(--faint)" }}>
            tokenising · scoring {question.split(/\s+/).filter(Boolean).length} terms
            against the corpus…
          </p>
        </div>
      )}

      {error && (
        <p className="mono mt-6" style={{ color: "var(--dead)" }}>
          {error}
        </p>
      )}

      {result && !loading && (
        <div className="mt-8 reveal">
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span
              className="mono"
              style={{ color: result.mode === "cached" ? "#6ee7b7" : "var(--signal)" }}
            >
              {result.mode}
            </span>
            <span className="mono" style={{ color: "var(--faint)" }}>
              retrieval {result.timings.retrieveMs.toFixed(1)}ms
            </span>
            {result.timings.synthesiseMs > 0 && (
              <span className="mono" style={{ color: "var(--faint)" }}>
                synthesis {result.timings.synthesiseMs.toFixed(0)}ms
              </span>
            )}
            {result.usage && (
              <span className="mono" style={{ color: "var(--faint)" }}>
                {result.usage.input} in / {result.usage.output} out tokens
              </span>
            )}
            <span className="mono" style={{ color: "var(--faint)" }}>
              {result.retrieval.lexical} lexical + {result.retrieval.expanded} graph-expanded
            </span>
            {result.costUsd > 0 && (
              <span className="mono" style={{ color: "var(--faint)" }}>
                ${result.costUsd.toFixed(5)}
              </span>
            )}
            <span className="mono" style={{ color: result.quota.remaining < 3 ? "var(--dead)" : "var(--faint)" }}>
              {result.quota.remaining}/{result.quota.capacity} left
            </span>
          </div>
          {result.retrieval.seeds.length > 0 && (
            <p className="mono mb-2" style={{ color: "var(--faint)" }}>
              graph entities matched: {result.retrieval.seeds.join(" · ")}
            </p>
          )}

          {result.cache?.hit && (
            <p
              className="mono mb-4 border-l-2 py-1 pl-3"
              style={{ borderColor: "#6ee7b7", color: "var(--faint)" }}
            >
              served from the semantic cache at{" "}
              {((result.cache.similarity ?? 0) * 100).toFixed(1)}% similarity to
              &ldquo;{result.cache.matchedQuestion}&rdquo; — no API call, no tokens,
              $0.00. reused {result.cache.reuseCount} times.
            </p>
          )}

          {result.context && (
            <p className="mono mb-4" style={{ color: "var(--faint)" }}>
              context trimmed to {result.context.kept} passages /{" "}
              {result.context.chars.toLocaleString()} chars
              {result.context.droppedDuplicate > 0 &&
                ` · ${result.context.droppedDuplicate} near-duplicate dropped`}
              {result.context.droppedBudget > 0 &&
                ` · ${result.context.droppedBudget} over budget`}
            </p>
          )}

          <p className="prose-body max-w-[68ch] text-[16px]" style={{ color: "var(--ink)" }}>
            {result.answer}
          </p>

          {result.warning && (
            <p
              className="mono mt-4 border-l-2 py-1 pl-3"
              style={{ borderColor: "var(--faint)", color: "var(--faint)" }}
            >
              {result.warning}
            </p>
          )}

          <div className="mt-10">
            <p className="mono mb-3" style={{ color: "var(--faint)" }}>
              what it retrieved, and why
            </p>

            {result.hits.length === 0 && (
              <p className="mono" style={{ color: "var(--dead)" }}>
                zero passages scored above nothing — the answer above is a refusal, not
                a guess
              </p>
            )}

            <div className="space-y-px">
              {result.hits.map((h) => {
                const width = (h.score / result.hits[0].score) * 100;
                return (
                  <div
                    key={h.id}
                    className="border-b py-3"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <div className="flex items-baseline gap-3">
                      <span className="num shrink-0 text-[12px]" style={{ color: "var(--signal)" }}>
                        [{h.rank}]
                      </span>
                      <Link
                        href={h.href}
                        className="text-[13.5px] font-medium underline decoration-transparent underline-offset-4 hover:decoration-[var(--signal)]"
                      >
                        {h.source}
                      </Link>
                      <span
                        className="mono ml-auto shrink-0 rounded border px-1.5 py-0.5"
                        style={{
                          borderColor: "var(--line)",
                          color: h.via === "graph" ? "#c4b5fd" : "var(--faint)",
                        }}
                        title={h.expandedFrom ? `reached via the graph from "${h.expandedFrom}"` : "matched lexically"}
                      >
                        {h.via === "graph" ? `graph · ${h.expandedFrom}` : "bm25"}
                      </span>
                      <span className="num shrink-0 text-[12px]" style={{ color: "var(--dim)" }}>
                        {h.score.toFixed(2)}
                      </span>
                    </div>

                    <div
                      className="mt-2 h-[3px] w-full overflow-hidden rounded-full"
                      style={{ background: "var(--raised)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${width}%`, background: "var(--signal)" }}
                      />
                    </div>

                    <p className="mt-2.5 max-w-[76ch] text-[13.5px]" style={{ color: "var(--dim)" }}>
                      {h.preview}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {h.terms.length === 0 && h.via === "graph" && (
                        <span className="mono" style={{ color: "var(--faint)" }}>
                          no lexical overlap — reached only through the knowledge graph
                        </span>
                      )}
                      {h.terms.map((t) => (
                        <span
                          key={t.term}
                          className="mono rounded border px-1.5 py-0.5"
                          style={{ borderColor: "var(--line)", color: "var(--faint)" }}
                          title={`BM25 contribution ${t.contribution.toFixed(3)}`}
                        >
                          {t.term} +{t.contribution.toFixed(2)}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
