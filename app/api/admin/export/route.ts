import { NextResponse } from "next/server";
import { exportAll } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Everything back out as JSON, for backup or for committing to git. */
export async function GET() {
  const data = await exportAll();
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="content-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
