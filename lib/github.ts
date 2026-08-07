import { cache } from "react";
import { span } from "./trace";

/* ------------------------------------------------------------------
   GITHUB — the receipts.
   The rest of this site is self-reported. This is the one source that
   isn't: commit timestamps nobody edits after the fact. It is used to
   check two claims — which technologies are actually in use, and
   whether the declared routine matches when code really gets written.

   Works without a token (60 req/hr). With GITHUB_TOKEN it is 5,000/hr
   and no scopes are required for public data.
   ------------------------------------------------------------------ */

const API = "https://api.github.com";
const TTL_MS = Number(process.env.GITHUB_CACHE_TTL_MS ?? 15 * 60 * 1000);
const TZ = process.env.GITHUB_TZ ?? "Asia/Kolkata";

export interface Repo {
  name: string;
  url: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  pushedAt: string;
  archived: boolean;
  fork: boolean;
}

export interface CommitSample {
  message: string;
  at: string;
  repo: string;
  /** hour 0–23 in TZ */
  hour: number;
  /** 0 = Sunday, in TZ */
  weekday: number;
}

export interface GithubStats {
  ok: boolean;
  error?: string;
  authenticated: boolean;
  fetchedAt: string;
  rateLimitRemaining: number | null;

  login: string;
  name: string | null;
  avatar: string | null;
  publicRepos: number;
  followers: number;
  createdAt: string | null;

  repos: Repo[];
  languages: { language: string; repos: number; stars: number }[];
  totalStars: number;

  /** sampled from recent public push events */
  commits: CommitSample[];
  hourHistogram: number[];
  weekdayHistogram: number[];

  quirks: {
    nightOwlShare: number;
    weekendShare: number;
    busiestHour: number;
    quietestActiveHour: number;
    longestSilenceDays: number;
    medianMessageLength: number;
    topWords: { word: string; count: number }[];
    fixToFeatRatio: number | null;
    conventionalShare: number;
    sampleWindowDays: number;
  };
}

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "igaurav-portfolio",
  };
  if (process.env.GITHUB_TOKEN)
    h.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

interface Cached {
  at: number;
  value: GithubStats;
}

function store(): { entry: Cached | null } {
  const g = globalThis as unknown as { __gh?: { entry: Cached | null } };
  if (!g.__gh) g.__gh = { entry: null };
  return g.__gh;
}

function inZone(iso: string): { hour: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(new Date(iso));
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    hour,
    weekday: Math.max(0, names.indexOf(parts.find((p) => p.type === "weekday")?.value ?? "Sun")),
  };
}

const MESSAGE_STOPWORDS = new Set(
  ("the a an and or of to in for on with from into at by is are was were this that " +
    "it its be as not no but if then so we i you our my me merge branch pull request " +
    "main master origin remote tracking commit commits").split(" "),
);

export const getGithubStats = cache(async (): Promise<GithubStats> => {
  const login = process.env.GITHUB_USERNAME;

  const empty = (error: string): GithubStats => ({
    ok: false,
    error,
    authenticated: Boolean(process.env.GITHUB_TOKEN),
    fetchedAt: new Date().toISOString(),
    rateLimitRemaining: null,
    login: login ?? "",
    name: null,
    avatar: null,
    publicRepos: 0,
    followers: 0,
    createdAt: null,
    repos: [],
    languages: [],
    totalStars: 0,
    commits: [],
    hourHistogram: new Array(24).fill(0),
    weekdayHistogram: new Array(7).fill(0),
    quirks: {
      nightOwlShare: 0,
      weekendShare: 0,
      busiestHour: 0,
      quietestActiveHour: 0,
      longestSilenceDays: 0,
      medianMessageLength: 0,
      topWords: [],
      fixToFeatRatio: null,
      conventionalShare: 0,
      sampleWindowDays: 0,
    },
  });

  if (!login) return empty("GITHUB_USERNAME is not set");

  const cached = store().entry;
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  return span("github.fetch", "net", async () => {
    try {
      let rateLimitRemaining: number | null = null;

      const get = async (path: string) => {
        const res = await fetch(`${API}${path}`, {
          headers: headers(),
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        const remaining = res.headers.get("x-ratelimit-remaining");
        if (remaining) rateLimitRemaining = Number(remaining);
        if (!res.ok) throw new Error(`${path} → ${res.status}`);
        return res.json();
      };

      const [user, rawRepos] = await Promise.all([
        get(`/users/${login}`),
        get(`/users/${login}/repos?per_page=100&sort=pushed&type=owner`),
      ]);

      // Public events: three pages is the practical maximum GitHub serves,
      // and it is the only commit-timestamp source that needs no scopes.
      const eventPages = await Promise.all(
        [1, 2, 3].map((page) =>
          get(`/users/${login}/events/public?per_page=100&page=${page}`).catch(() => []),
        ),
      );
      const events = eventPages.flat() as {
        type: string;
        created_at: string;
        repo?: { name: string };
        payload?: { commits?: { message: string }[] };
      }[];

      const repos: Repo[] = (rawRepos as Record<string, unknown>[])
        .map((r) => ({
          name: String(r.name),
          url: String(r.html_url),
          description: (r.description as string) ?? null,
          language: (r.language as string) ?? null,
          stars: Number(r.stargazers_count ?? 0),
          forks: Number(r.forks_count ?? 0),
          pushedAt: String(r.pushed_at ?? ""),
          archived: Boolean(r.archived),
          fork: Boolean(r.fork),
        }))
        .sort((a, b) => b.pushedAt.localeCompare(a.pushedAt));

      const langMap = new Map<string, { repos: number; stars: number }>();
      for (const r of repos) {
        if (!r.language || r.fork) continue;
        const entry = langMap.get(r.language) ?? { repos: 0, stars: 0 };
        entry.repos += 1;
        entry.stars += r.stars;
        langMap.set(r.language, entry);
      }

      const commits: CommitSample[] = [];
      for (const e of events) {
        if (e.type !== "PushEvent" || !e.payload?.commits) continue;
        const { hour, weekday } = inZone(e.created_at);
        for (const c of e.payload.commits) {
          commits.push({
            message: c.message.split("\n")[0].slice(0, 160),
            at: e.created_at,
            repo: e.repo?.name ?? "",
            hour,
            weekday,
          });
        }
      }

      const hourHistogram = new Array(24).fill(0);
      const weekdayHistogram = new Array(7).fill(0);
      for (const c of commits) {
        hourHistogram[c.hour] += 1;
        weekdayHistogram[c.weekday] += 1;
      }

      // ---- quirks, all computed, none decorative ----
      const total = commits.length || 1;
      const nightOwl = commits.filter((c) => c.hour >= 0 && c.hour < 5).length / total;
      const weekend = commits.filter((c) => c.weekday === 0 || c.weekday === 6).length / total;

      const busiestHour = hourHistogram.indexOf(Math.max(...hourHistogram));
      const activeHours = hourHistogram
        .map((n, h) => ({ n, h }))
        .filter((x) => x.n > 0)
        .sort((a, b) => a.n - b.n);
      const quietestActiveHour = activeHours[0]?.h ?? 0;

      const timestamps = [...new Set(commits.map((c) => c.at))]
        .map((t) => new Date(t).getTime())
        .sort((a, b) => a - b);
      let longestSilence = 0;
      for (let i = 1; i < timestamps.length; i++)
        longestSilence = Math.max(longestSilence, timestamps[i] - timestamps[i - 1]);

      const lengths = commits.map((c) => c.message.length).sort((a, b) => a - b);
      const medianMessageLength = lengths.length
        ? lengths[Math.floor(lengths.length / 2)]
        : 0;

      const wordCounts = new Map<string, number>();
      for (const c of commits) {
        for (const w of c.message.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/)) {
          if (w.length < 3 || MESSAGE_STOPWORDS.has(w)) continue;
          wordCounts.set(w, (wordCounts.get(w) ?? 0) + 1);
        }
      }
      const topWords = [...wordCounts.entries()]
        .map(([word, count]) => ({ word, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      const fixes = commits.filter((c) => /^fix(\(|:|\s)/i.test(c.message)).length;
      const feats = commits.filter((c) => /^feat(\(|:|\s)/i.test(c.message)).length;
      const conventional = commits.filter((c) =>
        /^(feat|fix|chore|docs|refactor|test|style|perf|ci|build)(\(.+\))?!?:/i.test(c.message),
      ).length;

      const windowDays = timestamps.length
        ? (timestamps[timestamps.length - 1] - timestamps[0]) / 86_400_000
        : 0;

      const value: GithubStats = {
        ok: true,
        authenticated: Boolean(process.env.GITHUB_TOKEN),
        fetchedAt: new Date().toISOString(),
        rateLimitRemaining,
        login: String(user.login),
        name: (user.name as string) ?? null,
        avatar: (user.avatar_url as string) ?? null,
        publicRepos: Number(user.public_repos ?? 0),
        followers: Number(user.followers ?? 0),
        createdAt: (user.created_at as string) ?? null,
        repos,
        languages: [...langMap.entries()]
          .map(([language, v]) => ({ language, ...v }))
          .sort((a, b) => b.repos - a.repos || b.stars - a.stars),
        totalStars: repos.reduce((n, r) => n + r.stars, 0),
        commits,
        hourHistogram,
        weekdayHistogram,
        quirks: {
          nightOwlShare: nightOwl,
          weekendShare: weekend,
          busiestHour,
          quietestActiveHour,
          longestSilenceDays: longestSilence / 86_400_000,
          medianMessageLength,
          topWords,
          fixToFeatRatio: feats > 0 ? fixes / feats : null,
          conventionalShare: conventional / total,
          sampleWindowDays: windowDays,
        },
      };

      store().entry = { at: Date.now(), value };
      return value;
    } catch (err) {
      const failed = empty(err instanceof Error ? err.message : "github unreachable");
      // Serve a stale-but-real reading rather than nothing.
      return store().entry?.value ?? failed;
    }
  }, `@${login}${process.env.GITHUB_TOKEN ? " (authenticated)" : " (anonymous, 60/hr)"}`);
});

/* ------------------------------------------------------------------
   A single repo — used by the footer for the "this site's own code"
   card. Separate from the stats fetch so a footer never waits on the
   full three-page event crawl.
   ------------------------------------------------------------------ */

export interface RepoCard {
  ok: boolean;
  fullName: string;
  url: string;
  description: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  language: string | null;
  pushedAt: string | null;
  license: string | null;
}

export const getRepoCard = cache(
  async (fullName = process.env.PORTFOLIO_REPO ?? "igaurav-dev/portfolio-v2"): Promise<RepoCard> => {
    const fallback: RepoCard = {
      ok: false,
      fullName,
      url: `https://github.com/${fullName}`,
      description: null,
      stars: 0,
      forks: 0,
      openIssues: 0,
      language: null,
      pushedAt: null,
      license: null,
    };

    const g = globalThis as unknown as { __repoCard?: { at: number; value: RepoCard } };
    if (g.__repoCard && Date.now() - g.__repoCard.at < TTL_MS) return g.__repoCard.value;

    return span("github.repo", "net", async () => {
      try {
        const res = await fetch(`${API}/repos/${fullName}`, {
          headers: headers(),
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) throw new Error(String(res.status));
        const r = await res.json();
        const value: RepoCard = {
          ok: true,
          fullName: String(r.full_name),
          url: String(r.html_url),
          description: (r.description as string) ?? null,
          stars: Number(r.stargazers_count ?? 0),
          forks: Number(r.forks_count ?? 0),
          openIssues: Number(r.open_issues_count ?? 0),
          language: (r.language as string) ?? null,
          pushedAt: (r.pushed_at as string) ?? null,
          license: (r.license?.spdx_id as string) ?? null,
        };
        g.__repoCard = { at: Date.now(), value };
        return value;
      } catch {
        // The link still works; only the live numbers are missing.
        return g.__repoCard?.value ?? fallback;
      }
    }, fullName);
  },
);
