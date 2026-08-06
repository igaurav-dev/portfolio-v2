import { NextResponse } from "next/server";
import { getGithubStats } from "@/lib/github";

export const dynamic = "force-dynamic";

/** Compact projection for the terminal's `gh` command. */
export async function GET() {
  const gh = await getGithubStats();
  if (!gh.ok) {
    return NextResponse.json(
      { ok: false, error: gh.error ?? "unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  return NextResponse.json(
    {
      ok: true,
      login: gh.login,
      publicRepos: gh.publicRepos,
      totalStars: gh.totalStars,
      commits: gh.commits.length,
      busiestHour: gh.quirks.busiestHour,
      nightOwlShare: gh.quirks.nightOwlShare,
      weekendShare: gh.quirks.weekendShare,
      conventionalShare: gh.quirks.conventionalShare,
      languages: gh.languages.slice(0, 6).map((l) => l.language),
      authenticated: gh.authenticated,
      fetchedAt: gh.fetchedAt,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
