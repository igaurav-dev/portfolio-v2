import { cache } from "react";
import { span } from "./trace";
import {
  getProjects,
  getDecisions,
  getTimeline,
  getProfile,
  getSkills,
  getDeltas,
} from "./content";
import { buildGraph, matchNodes, neighbourhood } from "./graph";

/* ------------------------------------------------------------------
   Hybrid retrieval: BM25 for lexical precision, then one hop through
   the knowledge graph for recall. Both halves run without an API key,
   and the console shows exactly what each contributed.
   ------------------------------------------------------------------ */

export interface Chunk {
  id: string;
  source: string;
  href: string;
  text: string;
  /** graph node this chunk belongs to, used for graph expansion */
  entity?: string;
}

export interface Hit extends Chunk {
  score: number;
  via: "bm25" | "graph";
  terms: { term: string; contribution: number }[];
  expandedFrom?: string;
}

const STOPWORDS = new Set(
  ("a an and are as at be but by for from has have he her his i in is it its of on or " +
    "she that the their them they this to was were what when which who will with you your " +
    "do does did how why we our us if then than so such into over under about can could " +
    "would should had been being there here also more most some any all no not").split(" "),
);

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9+#./-]+/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^[./-]+|[./-]+$/g, ""))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export const buildCorpus = cache(async (): Promise<Chunk[]> => {
  const [projects, decisions, timeline, profile, skills, deltas] =
    await Promise.all([
      getProjects(),
      getDecisions(),
      getTimeline(),
      getProfile(),
      getSkills(),
      getDeltas(),
    ]);

  return span("corpus.build", "compute", () => {
    const chunks: Chunk[] = [];

    chunks.push({
      id: "profile:statement",
      source: "About",
      href: "/about",
      entity: "person:me",
      text: `${profile.name} is a ${profile.role} based in ${profile.location} with ${profile.yearsExperience} years of experience. ${profile.statement}`,
    });
    profile.principles.forEach((p, i) =>
      chunks.push({
        id: `profile:principle:${i}`,
        source: "About · how he works",
        href: "/about",
        entity: "person:me",
        text: p,
      }),
    );

    for (const [category, list] of Object.entries(skills)) {
      chunks.push({
        id: `skills:${category}`,
        source: `Skills · ${category}`,
        href: "/graph",
        text: `${category} skills: ${list.join(", ")}.`,
      });
    }

    for (const p of projects) {
      const entity = `project:${p.slug}`;
      chunks.push({
        id: `${entity}:summary`,
        source: `${p.name} · overview`,
        href: `/work/${p.slug}`,
        entity,
        text: `${p.name} (${p.year}, ${p.client}, role: ${p.role}). ${p.tagline} ${p.summary} Built with ${p.stack.join(", ")}.`,
      });
      chunks.push({
        id: `${entity}:problem`,
        source: `${p.name} · the problem`,
        href: `/work/${p.slug}`,
        entity,
        text: `The problem on ${p.name}: ${p.problem}`,
      });
      chunks.push({
        id: `${entity}:approach`,
        source: `${p.name} · approach`,
        href: `/work/${p.slug}`,
        entity,
        text: `Approach on ${p.name}: ${p.approach.join(" ")}`,
      });
      chunks.push({
        id: `${entity}:tradeoffs`,
        source: `${p.name} · trade-offs`,
        href: `/work/${p.slug}`,
        entity,
        text: `Trade-offs accepted on ${p.name}: ${p.tradeoffs}`,
      });
      chunks.push({
        id: `${entity}:metrics`,
        source: `${p.name} · results`,
        href: `/work/${p.slug}`,
        entity,
        text: `Results on ${p.name}: ${p.metrics
          .map((m) => `${m.label} — ${m.value}${m.note ? ` (${m.note})` : ""}`)
          .join("; ")}.`,
      });
      if (p.wentWrong.trim()) {
        chunks.push({
          id: `${entity}:wrong`,
          source: `${p.name} · what went wrong`,
          href: `/work/${p.slug}`,
          entity,
          text: `What went wrong on ${p.name}: ${p.wentWrong}`,
        });
      }
    }

    for (const d of decisions) {
      const entity = `decision:${d.id}`;
      chunks.push({
        id: `${entity}:body`,
        source: `Decision · ${d.title}`,
        href: `/decisions#${d.id}`,
        entity,
        text: `${d.title} (${d.date}). Context: ${d.context} Decision: ${d.decision} Consequence: ${d.consequence}`,
      });
      chunks.push({
        id: `${entity}:alternatives`,
        source: `Decision · ${d.title} · alternatives`,
        href: `/decisions#${d.id}`,
        entity,
        text: `Alternatives considered for "${d.title}": ${d.alternatives
          .map((a) => `${a.option} — ${a.why}`)
          .join(" ")}`,
      });
    }

    for (const r of timeline) {
      const entity = `company:${r.org.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      chunks.push({
        id: `${entity}:role`,
        source: `Experience · ${r.org}`,
        href: "/resume",
        entity,
        text: `${r.role} at ${r.org}, ${r.period}, ${r.location}. ${r.note}`,
      });
      chunks.push({
        id: `${entity}:highlights`,
        source: `Experience · ${r.org} · highlights`,
        href: "/resume",
        entity,
        text: `At ${r.org}: ${r.highlights.join(" ")}`,
      });
    }

    for (const d of deltas) {
      chunks.push({
        id: `delta:${d.at}`,
        source: `Growth · ${d.at.slice(0, 10)}`,
        href: "/growth",
        text: `${d.summary} Newly picked up: ${d.learned.join(", ")}. Added: ${d.added.join(", ")}.`,
      });
    }

    return chunks;
  }, "derived from content/, never hand-maintained");
});

interface Index {
  chunks: Chunk[];
  byId: Map<string, Chunk>;
  byEntity: Map<string, Chunk[]>;
  docs: { freq: Map<string, number>; length: number }[];
  df: Map<string, number>;
  avgLength: number;
}

const buildIndex = cache(async (): Promise<Index> => {
  const chunks = await buildCorpus();
  return span("bm25.index", "compute", () => {
    const df = new Map<string, number>();
    const byEntity = new Map<string, Chunk[]>();

    const docs = chunks.map((c) => {
      const tokens = tokenize(c.text);
      const freq = new Map<string, number>();
      for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
      for (const t of freq.keys()) df.set(t, (df.get(t) ?? 0) + 1);
      if (c.entity) byEntity.set(c.entity, [...(byEntity.get(c.entity) ?? []), c]);
      return { freq, length: tokens.length };
    });

    return {
      chunks,
      byId: new Map(chunks.map((c) => [c.id, c])),
      byEntity,
      docs,
      df,
      avgLength: docs.reduce((s, d) => s + d.length, 0) / Math.max(docs.length, 1),
    };
  }, `${chunks.length} chunks`);
});

const K1 = 1.5;
const B = 0.75;
/** Graph-expanded hits are damped so lexical evidence still wins. */
const GRAPH_DAMPING = 0.45;

export interface RetrievalResult {
  hits: Hit[];
  lexical: number;
  expanded: number;
  seeds: string[];
}

export async function retrieve(query: string, k = 6): Promise<RetrievalResult> {
  const index = await buildIndex();

  const lexical = await span("bm25.search", "compute", () => {
    const terms = tokenize(query);
    const N = index.docs.length;
    if (terms.length === 0 || N === 0) return [] as Hit[];

    const scored = index.docs.map((doc, i) => {
      const contributions: { term: string; contribution: number }[] = [];
      let score = 0;
      for (const term of new Set(terms)) {
        const tf = doc.freq.get(term);
        if (!tf) continue;
        const df = index.df.get(term) ?? 0;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        const denom = tf + K1 * (1 - B + (B * doc.length) / index.avgLength);
        const contribution = idf * ((tf * (K1 + 1)) / denom);
        score += contribution;
        contributions.push({ term, contribution });
      }
      return {
        ...index.chunks[i],
        score,
        via: "bm25" as const,
        terms: contributions.sort((a, b) => b.contribution - a.contribution).slice(0, 4),
      };
    });

    return scored
      .filter((h) => h.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }, `query="${query.slice(0, 48)}"`);

  // One hop through the graph. A question naming a technology reaches the
  // projects that used it even when no chunk shares the query's wording.
  const graph = await buildGraph();
  const expansion = await span("graph.expand", "compute", () => {
    const seeds = matchNodes(graph, query);
    const seen = new Set(lexical.map((h) => h.id));
    const extra: Hit[] = [];

    for (const seed of seeds) {
      for (const neighbour of neighbourhood(graph, seed.id, 1)) {
        for (const chunk of index.byEntity.get(neighbour) ?? []) {
          if (seen.has(chunk.id)) continue;
          seen.add(chunk.id);
          extra.push({
            ...chunk,
            score: GRAPH_DAMPING * (1 + seed.label.length / 40),
            via: "graph",
            terms: [],
            expandedFrom: seed.label,
          });
        }
      }
    }

    return {
      seeds: seeds.map((s) => s.label),
      extra: extra.sort((a, b) => b.score - a.score).slice(0, 3),
    };
  }, "one hop from matched entities");

  const hits = [...lexical, ...expansion.extra].slice(0, k + 3);

  return {
    hits,
    lexical: lexical.length,
    expanded: expansion.extra.length,
    seeds: expansion.seeds,
  };
}

/**
 * Extractive fallback. Used when no ANTHROPIC_API_KEY is configured.
 * It never invents a sentence — it only selects them.
 */
export function extractiveAnswer(query: string, hits: Hit[]): string {
  if (hits.length === 0) {
    return "Nothing in the corpus matches that. It only covers the work, the decision log, the CV and the skills graph — ask about one of those and the retrieval will have something to stand on.";
  }
  const queryTerms = new Set(tokenize(query));
  const sentences = hits
    .flatMap((hit) =>
      hit.text.split(/(?<=[.!?])\s+/).map((sentence) => {
        const overlap = tokenize(sentence).filter((t) => queryTerms.has(t)).length;
        return { sentence: sentence.trim(), overlap, base: hit.score };
      }),
    )
    .filter((s) => s.overlap > 0 && s.sentence.length > 40)
    .sort((a, b) => b.overlap - a.overlap || b.base - a.base)
    .slice(0, 3);

  if (sentences.length === 0) return hits[0].text.slice(0, 420);
  return sentences.map((s) => s.sentence).join(" ");
}
