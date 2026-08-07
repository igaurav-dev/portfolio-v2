import { NextResponse } from "next/server";
import { SCHEMAS } from "@/lib/admin-schema";

export const dynamic = "force-dynamic";

/**
 * The same field definitions that drive the web editors, served to the
 * mobile app so both clients render identical forms from one source.
 * Add a field in lib/admin-schema.ts and it appears in both.
 */
export async function GET() {
  return NextResponse.json(
    { version: 1, collections: SCHEMAS },
    { headers: { "cache-control": "no-store" } },
  );
}
