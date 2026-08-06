import { NextResponse } from "next/server";
import { readTrace } from "@/lib/trace";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const trace = readTrace(id);

  // Traces live in the memory of the instance that rendered the page. On a
  // multi-instance deploy the follow-up request can land elsewhere, and we
  // say so rather than inventing numbers.
  if (!trace) {
    return NextResponse.json(
      { id, found: false, spans: [], region: "—", runtime: "—" },
      { headers: { "cache-control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      id: trace.id,
      route: trace.route,
      region: trace.region,
      runtime: trace.runtime,
      found: true,
      spans: trace.spans,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
