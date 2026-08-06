import { backend, collection } from "./db";
import { span } from "./trace";

/* ------------------------------------------------------------------
   SEMANTIC CACHE
   "What has he built with Qdrant?" and "which projects used Qdrant"
   are the same question. Only genuinely novel questions should cost
   anything, so every answer is stored with a normalised vector and new
   questions are matched against it before the API is considered.
   ------------------------------------------------------------------ */

export const SIMILARITY_THRESHOLD = Number(
  process.env.ASK_CACHE_THRESHOLD ?? 0.84,
);

/* ---------------- intent ----------------
   Two questions are the same question when they are about the same
   entities AND asking the same *kind* of thing. Lexical similarity
   alone cannot see that "built with Qdrant" and "projects that used
   Qdrant" are one question, so entities and intent carry most of the
   weight and cosine is only the tie-breaker.
   ---------------------------------------- */

export type Intent =
  | "why"
  | "how"
  | "built"
  | "experience"
  | "when"
  | "who"
  | "what"
  | "general";

const INTENT_RULES: [Intent, RegExp][] = [
  ["why", /\bwhy\b|\breason\b|\brationale\b|instead of|rather than|over\b/i],
  ["how", /\bhow\b|\bapproach\b|\bmethod\b|\bprocess\b/i],
  [
    "built",
    /\b(built|build|building|made|created|shipped|projects?|worked on|use[ds]?|using)\b/i,
  ],
  [
    "experience",
    /\b(experience|familiar|know|knows|comfortable|skilled|worked with|any\s)\b/i,
  ],
  ["when", /\bwhen\b|\bhow long\b|\byears?\b|\bduration\b/i],
  ["who", /\bwho\b|\bcontact\b|\bhire\b|\bavailable\b/i],
  ["what", /\bwhat\b|\bwhich\b|\bdescribe\b|\btell me\b/i],
];

export function classifyIntent(question: string): Intent {
  for (const [intent, pattern] of INTENT_RULES) {
    if (pattern.test(question)) return intent;
  }
  return "general";
}

/**
 * Intent families. "What is SustainIT" and "describe the SustainIT project"
 * are both descriptive and should share an answer; "why did he pick Qdrant"
 * is causal and must not collapse into "what did he build with Qdrant".
 */
const FAMILY: Record<Intent, "descriptive" | "causal" | "procedural" | "factual"> = {
  what: "descriptive",
  built: "descriptive",
  general: "descriptive",
  why: "causal",
  how: "procedural",
  when: "factual",
  who: "factual",
  experience: "factual",
};

function intentAgreement(a: Intent, b: Intent): number {
  if (a === b) return 1;
  return FAMILY[a] === FAMILY[b] ? 0.6 : 0;
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const setA = new Set(a.map((x) => x.toLowerCase()));
  const setB = new Set(b.map((x) => x.toLowerCase()));
  let shared = 0;
  for (const x of setA) if (setB.has(x)) shared += 1;
  const union = new Set([...setA, ...setB]).size;
  return union ? shared / union : 0;
}

/**
 * Combined similarity. Entity agreement dominates, intent confirms it,
 * and cosine only decides between candidates that already agree — or
 * carries the whole judgement when no entity was recognised at all.
 */
export function similarity(
  a: { vector: Map<string, number>; entities: string[]; intent: Intent },
  b: { vector: Map<string, number>; entities: string[]; intent: Intent },
): number {
  const lexical = cosine(a.vector, b.vector);

  // Neither question named a known entity — fall back to pure lexical,
  // where a high bar is appropriate because there is nothing else to go on.
  if (a.entities.length === 0 && b.entities.length === 0) return lexical;

  const entities = jaccard(a.entities, b.entities);
  const intent = intentAgreement(a.intent, b.intent);

  // Different subject matter is disqualifying regardless of phrasing.
  if (entities < 0.5) return Math.min(lexical, 0.5);

  return 0.62 * entities + 0.24 * intent + 0.14 * lexical;
}
const MAX_ENTRIES = 400;
const TTL_MS = Number(process.env.ASK_CACHE_TTL_MS ?? 7 * 24 * 60 * 60 * 1000);

const STOPWORDS = new Set(
  ("a an and are as at be but by for from has have he her his i in is it its of on or " +
    "she that the their them they this to was were what when which who will with you your " +
    "do does did how why we our us if then than so such into over under about can could " +
    "would should had been being there here also more most some any all no not tell me " +
    "give show know about does he did his him gaurav").split(/\s+/),
);

/** Light stemming — enough to fold plurals and gerunds together. */
function stem(token: string): string {
  return token
    .replace(/(ations?|ing|ed|es|s)$/i, "")
    .replace(/i$/i, "y");
}

export function vectorise(text: string): Map<string, number> {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9+#.-]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem)
    .filter((t) => t.length > 1);

  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);

  // sublinear tf, then L2 normalise so cosine is a plain dot product
  let norm = 0;
  for (const [term, count] of tf) {
    const weight = 1 + Math.log(count);
    tf.set(term, weight);
    norm += weight * weight;
  }
  norm = Math.sqrt(norm) || 1;
  for (const [term, weight] of tf) tf.set(term, weight / norm);
  return tf;
}

export function cosine(a: Map<string, number>, b: Map<string, number>): number {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [term, weight] of small) {
    const other = large.get(term);
    if (other) dot += weight * other;
  }
  return dot;
}

export interface CacheEntry {
  key: string;
  question: string;
  vector: [string, number][];
  entities: string[];
  intent: Intent;
  answer: string;
  hits: unknown[];
  retrieval: unknown;
  createdAt: number;
  reuseCount: number;
  originalCostUsd: number;
}

interface CacheStore {
  entries: CacheEntry[];
  hits: number;
  misses: number;
  savedUsd: number;
  hydrated: boolean;
}

function store(): CacheStore {
  const g = globalThis as unknown as { __askCache?: CacheStore };
  if (!g.__askCache)
    g.__askCache = { entries: [], hits: 0, misses: 0, savedUsd: 0, hydrated: false };
  return g.__askCache;
}

/** Load persisted entries once per process, if a database is configured. */
async function hydrate(): Promise<void> {
  const s = store();
  if (s.hydrated) return;
  s.hydrated = true;
  if (backend() !== "mongodb") return;
  try {
    const col = await collection<CacheEntry & Record<string, unknown>>("ask_cache");
    const rows = await col
      .find({}, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .limit(MAX_ENTRIES)
      .toArray();
    s.entries = rows as unknown as CacheEntry[];
  } catch {
    // cache persistence is a nicety, never a hard dependency
  }
}

export interface CacheLookup {
  entry: CacheEntry;
  similarity: number;
}

export async function lookup(
  question: string,
  entities: string[] = [],
): Promise<CacheLookup | null> {
  await hydrate();
  const s = store();
  const now = Date.now();
  s.entries = s.entries.filter((e) => now - e.createdAt < TTL_MS);

  return span("cache.lookup", "cache", () => {
    const probe = {
      vector: vectorise(question),
      entities,
      intent: classifyIntent(question),
    };
    let best: CacheLookup | null = null;

    for (const entry of s.entries) {
      const score = similarity(probe, {
        vector: new Map(entry.vector),
        entities: entry.entities ?? [],
        intent: entry.intent ?? "general",
      });
      if (score > (best?.similarity ?? 0)) best = { entry, similarity: score };
    }

    if (best && best.similarity >= SIMILARITY_THRESHOLD) {
      best.entry.reuseCount += 1;
      s.hits += 1;
      s.savedUsd += best.entry.originalCostUsd;
      return best;
    }
    s.misses += 1;
    return null;
  }, `${s.entries.length} cached questions`);
}

export async function remember(
  entry: Omit<CacheEntry, "key" | "vector" | "createdAt" | "reuseCount" | "intent">,
): Promise<void> {
  const s = store();
  const record: CacheEntry = {
    ...entry,
    key: entry.question.toLowerCase().trim(),
    vector: [...vectorise(entry.question).entries()],
    intent: classifyIntent(entry.question),
    createdAt: Date.now(),
    reuseCount: 0,
  };

  s.entries = [record, ...s.entries.filter((e) => e.key !== record.key)].slice(
    0,
    MAX_ENTRIES,
  );

  if (backend() === "mongodb") {
    try {
      const col = await collection<CacheEntry & Record<string, unknown>>("ask_cache");
      await col.updateOne(
        { key: record.key },
        { $set: { ...record } as Record<string, unknown> },
        { upsert: true },
      );
    } catch {
      /* in-memory copy is still live */
    }
  }
}

export interface CacheStats {
  entries: number;
  hits: number;
  misses: number;
  hitRate: number;
  savedUsd: number;
  threshold: number;
  persisted: boolean;
}

export function cacheStats(): CacheStats {
  const s = store();
  const total = s.hits + s.misses;
  return {
    entries: s.entries.length,
    hits: s.hits,
    misses: s.misses,
    hitRate: total ? s.hits / total : 0,
    savedUsd: s.savedUsd,
    threshold: SIMILARITY_THRESHOLD,
    persisted: backend() === "mongodb",
  };
}

/* ---------------- context budgeting ---------------- */

export const MAX_CONTEXT_CHARS = Number(process.env.ASK_CONTEXT_CHARS ?? 3600);
const MAX_PASSAGE_CHARS = 620;

export interface Passage {
  source: string;
  text: string;
  score: number;
}

/**
 * Trim the prompt to what actually earns its place: drop near-duplicates,
 * cap each passage, and stop at a total character budget. Fewer input
 * tokens is the cheapest optimisation available and it usually improves
 * grounding rather than hurting it.
 */
export function budgetContext(passages: Passage[]): {
  kept: Passage[];
  droppedDuplicate: number;
  droppedBudget: number;
  chars: number;
} {
  const kept: Passage[] = [];
  const vectors: Map<string, number>[] = [];
  let chars = 0;
  let droppedDuplicate = 0;
  let droppedBudget = 0;

  for (const passage of passages) {
    const vector = vectorise(passage.text);
    if (vectors.some((v) => cosine(v, vector) > 0.92)) {
      droppedDuplicate += 1;
      continue;
    }

    const text =
      passage.text.length > MAX_PASSAGE_CHARS
        ? `${passage.text.slice(0, MAX_PASSAGE_CHARS).replace(/\s+\S*$/, "")}…`
        : passage.text;

    if (chars + text.length > MAX_CONTEXT_CHARS) {
      droppedBudget += 1;
      continue;
    }

    kept.push({ ...passage, text });
    vectors.push(vector);
    chars += text.length;
  }

  return { kept, droppedDuplicate, droppedBudget, chars };
}
