/* ------------------------------------------------------------------
   Rate limiting + cost metering.
   Synthesis costs real money, so the budget is finite and the site
   says so out loud rather than failing mysteriously at the limit.
   ------------------------------------------------------------------ */

export interface Bucket {
  tokens: number;
  updatedAt: number;
}

export interface LimitConfig {
  /** requests allowed per window */
  capacity: number;
  /** window length in ms */
  windowMs: number;
}

export const ASK_LIMIT: LimitConfig = {
  capacity: Number(process.env.ASK_RATE_LIMIT ?? 8),
  windowMs: Number(process.env.ASK_RATE_WINDOW_MS ?? 60 * 60 * 1000),
};

/** Daily ceiling on synthesis spend across all visitors, in USD. */
export const DAILY_BUDGET_USD = Number(process.env.ASK_DAILY_BUDGET_USD ?? 1);

/** Per-million-token rates. Override if the model or pricing changes. */
export const RATE_IN_PER_MTOK = Number(process.env.ASK_RATE_IN_PER_MTOK ?? 3);
export const RATE_OUT_PER_MTOK = Number(process.env.ASK_RATE_OUT_PER_MTOK ?? 15);

interface Meter {
  buckets: Map<string, Bucket>;
  spentUsd: number;
  spendDay: string;
  answered: number;
  refused: number;
}

function meter(): Meter {
  const g = globalThis as unknown as { __askMeter?: Meter };
  if (!g.__askMeter) {
    g.__askMeter = {
      buckets: new Map(),
      spentUsd: 0,
      spendDay: new Date().toISOString().slice(0, 10),
      answered: 0,
      refused: 0,
    };
  }
  return g.__askMeter;
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "local";
  return ip;
}

export interface LimitVerdict {
  allowed: boolean;
  remaining: number;
  capacity: number;
  resetInMs: number;
}

/** Continuous token-bucket refill: no cliff at the window boundary. */
export function consume(key: string, config = ASK_LIMIT): LimitVerdict {
  const m = meter();
  const now = Date.now();
  const refillPerMs = config.capacity / config.windowMs;

  const bucket = m.buckets.get(key) ?? { tokens: config.capacity, updatedAt: now };
  const replenished = Math.min(
    config.capacity,
    bucket.tokens + (now - bucket.updatedAt) * refillPerMs,
  );

  if (replenished < 1) {
    m.buckets.set(key, { tokens: replenished, updatedAt: now });
    return {
      allowed: false,
      remaining: 0,
      capacity: config.capacity,
      resetInMs: Math.ceil((1 - replenished) / refillPerMs),
    };
  }

  const remaining = replenished - 1;
  m.buckets.set(key, { tokens: remaining, updatedAt: now });

  // keep the map from growing without bound on a long-lived instance
  if (m.buckets.size > 5000) {
    const cutoff = now - config.windowMs * 2;
    for (const [k, v] of m.buckets) if (v.updatedAt < cutoff) m.buckets.delete(k);
  }

  return {
    allowed: true,
    remaining: Math.floor(remaining),
    capacity: config.capacity,
    resetInMs: Math.ceil((config.capacity - remaining) / refillPerMs),
  };
}

export function peek(key: string, config = ASK_LIMIT): LimitVerdict {
  const m = meter();
  const now = Date.now();
  const refillPerMs = config.capacity / config.windowMs;
  const bucket = m.buckets.get(key) ?? { tokens: config.capacity, updatedAt: now };
  const replenished = Math.min(
    config.capacity,
    bucket.tokens + (now - bucket.updatedAt) * refillPerMs,
  );
  return {
    allowed: replenished >= 1,
    remaining: Math.floor(replenished),
    capacity: config.capacity,
    resetInMs: Math.ceil((config.capacity - replenished) / refillPerMs),
  };
}

export function estimateCost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * RATE_IN_PER_MTOK +
    (outputTokens / 1_000_000) * RATE_OUT_PER_MTOK
  );
}

export function recordSpend(usd: number): void {
  const m = meter();
  const today = new Date().toISOString().slice(0, 10);
  if (m.spendDay !== today) {
    m.spendDay = today;
    m.spentUsd = 0;
  }
  m.spentUsd += usd;
  m.answered += 1;
}

export function recordRefusal(): void {
  meter().refused += 1;
}

export interface BudgetState {
  spentUsd: number;
  budgetUsd: number;
  exhausted: boolean;
  answered: number;
  refused: number;
  activeClients: number;
}

export function budget(): BudgetState {
  const m = meter();
  const today = new Date().toISOString().slice(0, 10);
  const spent = m.spendDay === today ? m.spentUsd : 0;
  return {
    spentUsd: spent,
    budgetUsd: DAILY_BUDGET_USD,
    exhausted: spent >= DAILY_BUDGET_USD,
    answered: m.answered,
    refused: m.refused,
    activeClients: m.buckets.size,
  };
}
