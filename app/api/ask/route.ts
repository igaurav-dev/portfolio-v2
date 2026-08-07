import { NextResponse } from "next/server";
import { retrieve, extractiveAnswer } from "@/lib/retrieval";
import {
  ASK_LIMIT,
  budget,
  clientKey,
  consume,
  estimateCost,
  peek,
  recordRefusal,
  recordSpend,
} from "@/lib/ratelimit";
import {
  budgetContext,
  cacheStats,
  lookup,
  remember,
} from "@/lib/semantic-cache";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MODEL = process.env.ASK_MODEL ?? "claude-sonnet-4-5";

const SYSTEM = `You answer questions about Gaurav Kumar using ONLY the numbered passages provided.

Rules:
- Every factual claim must come from a passage. Cite it inline as [1], [2], etc.
- If the passages do not answer the question, say exactly what is missing. Do not fill the gap from general knowledge.
- Never invent a metric, date, employer or technology that is not in a passage.
- Write in third person about Gaurav.

Format:
- At most 150 words total.
- Break it into 2-3 short paragraphs separated by a blank line. Never return one
  long block of prose — it is unreadable on a phone.
- No headings, no bullet lists, no markdown emphasis. Plain sentences only.
- Put each citation immediately after the claim it supports, not in a cluster at
  the end of the paragraph.`;

/** Budget and quota, so the console can show it before anyone spends anything. */
export async function GET(request: Request) {
  const limit = peek(clientKey(request));
  const state = budget();
  return NextResponse.json(
    {
      remaining: limit.remaining,
      capacity: limit.capacity,
      resetInMs: limit.resetInMs,
      windowMs: ASK_LIMIT.windowMs,
      synthesisEnabled: Boolean(process.env.ANTHROPIC_API_KEY),
      budget: state,
      cache: cacheStats(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const started = performance.now();

  let body: { question?: unknown };
  try {
    body = (await request.json()) as { question?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question || question.length > 500) {
    return NextResponse.json(
      { error: "question must be between 1 and 500 characters" },
      { status: 400 },
    );
  }

  const key = clientKey(request);
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const state = budget();

  // Retrieval is cheap and local, so it is never rate limited. Only
  // synthesis draws on the quota, because only synthesis costs money.
  let limit = peek(key);
  let useSynthesis = hasKey && !state.exhausted;
  let limited: string | null = null;

  if (useSynthesis) {
    limit = consume(key);
    if (!limit.allowed) {
      useSynthesis = false;
      limited = `rate limit reached — ${ASK_LIMIT.capacity} synthesised answers per hour per visitor. Retrieval below is still live and unlimited; a new token frees up in ${Math.ceil(limit.resetInMs / 1000)}s.`;
      recordRefusal();
    }
  } else if (hasKey && state.exhausted) {
    limited = `today's synthesis budget of $${state.budgetUsd.toFixed(2)} is spent. Retrieval below is unaffected and still exact.`;
  }

  const tRetrieve = performance.now();
  const { hits, lexical, expanded, seeds } = await retrieve(question, 6);
  const retrieveMs = performance.now() - tRetrieve;

  // Before spending anything: has this question already been answered in
  // a different phrasing? Cache hits cost nothing and never touch quota.
  const cached = hasKey ? await lookup(question, seeds) : null;
  if (cached) {
    return NextResponse.json(
      {
        answer: cached.entry.answer,
        mode: "cached",
        warning: null,
        usage: null,
        costUsd: 0,
        cache: {
          hit: true,
          similarity: cached.similarity,
          matchedQuestion: cached.entry.question,
          reuseCount: cached.entry.reuseCount,
          savedUsd: cached.entry.originalCostUsd,
          stats: cacheStats(),
        },
        quota: {
          remaining: limit.remaining,
          capacity: limit.capacity,
          resetInMs: limit.resetInMs,
        },
        budget: budget(),
        retrieval: { lexical, expanded, seeds },
        context: null,
        timings: {
          retrieveMs,
          synthesiseMs: 0,
          totalMs: performance.now() - started,
        },
        hits: hits.map((h, i) => ({
          rank: i + 1,
          id: h.id,
          source: h.source,
          href: h.href,
          score: h.score,
          via: h.via,
          expandedFrom: h.expandedFrom ?? null,
          terms: h.terms,
          preview: h.text.length > 300 ? `${h.text.slice(0, 300)}…` : h.text,
        })),
      },
      { headers: { "cache-control": "no-store" } },
    );
  }

  let answer: string;
  let mode: "synthesised" | "extractive";
  let synthesiseMs = 0;
  let usage: { input: number; output: number } | null = null;
  let costUsd = 0;
  let warning: string | null = limited;

  let contextReport: {
    kept: number;
    droppedDuplicate: number;
    droppedBudget: number;
    chars: number;
  } | null = null;

  if (useSynthesis && hits.length > 0) {
    const trimmed = budgetContext(
      hits.map((h) => ({ source: h.source, text: h.text, score: h.score })),
    );
    contextReport = {
      kept: trimmed.kept.length,
      droppedDuplicate: trimmed.droppedDuplicate,
      droppedBudget: trimmed.droppedBudget,
      chars: trimmed.chars,
    };
    const context = trimmed.kept
      .map((h, i) => `[${i + 1}] (${h.source})\n${h.text}`)
      .join("\n\n");
    const t0 = performance.now();
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY as string,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 400,
          system: SYSTEM,
          messages: [
            { role: "user", content: `Passages:\n\n${context}\n\nQuestion: ${question}` },
          ],
        }),
      });
      if (!res.ok) throw new Error(`anthropic ${res.status}`);
      const data = (await res.json()) as {
        content: { type: string; text?: string }[];
        usage?: { input_tokens: number; output_tokens: number };
      };
      answer =
        data.content
          .filter((c) => c.type === "text")
          .map((c) => c.text ?? "")
          .join("")
          .trim() || extractiveAnswer(question, hits);
      mode = "synthesised";
      if (data.usage) {
        usage = { input: data.usage.input_tokens, output: data.usage.output_tokens };
        costUsd = estimateCost(usage.input, usage.output);
        recordSpend(costUsd);
      }
      await remember({
        question,
        answer,
        entities: seeds,
        hits: [],
        retrieval: { lexical, expanded, seeds },
        originalCostUsd: costUsd,
      });
    } catch (err) {
      answer = extractiveAnswer(question, hits);
      mode = "extractive";
      warning = `synthesis failed (${err instanceof Error ? err.message : "unknown"}) — fell back to extractive`;
    }
    synthesiseMs = performance.now() - t0;
  } else {
    answer = extractiveAnswer(question, hits);
    mode = "extractive";
    if (!warning && !hasKey) {
      warning =
        "no ANTHROPIC_API_KEY configured — answers are extracted verbatim from the retrieved passages, never generated";
    }
  }

  const after = budget();

  return NextResponse.json(
    {
      answer,
      mode,
      warning,
      usage,
      costUsd,
      cache: { hit: false, stats: cacheStats() },
      context: contextReport,
      quota: {
        remaining: limit.remaining,
        capacity: limit.capacity,
        resetInMs: limit.resetInMs,
      },
      budget: after,
      retrieval: { lexical, expanded, seeds },
      timings: {
        retrieveMs,
        synthesiseMs,
        totalMs: performance.now() - started,
      },
      hits: hits.map((h, i) => ({
        rank: i + 1,
        id: h.id,
        source: h.source,
        href: h.href,
        score: h.score,
        via: h.via,
        expandedFrom: h.expandedFrom ?? null,
        terms: h.terms,
        preview: h.text.length > 300 ? `${h.text.slice(0, 300)}…` : h.text,
      })),
    },
    {
      headers: {
        "cache-control": "no-store",
        "x-ratelimit-limit": String(limit.capacity),
        "x-ratelimit-remaining": String(limit.remaining),
      },
    },
  );
}
