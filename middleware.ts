import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const PUBLIC_API = ["/api/admin/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminApi =
    pathname.startsWith("/api/admin") &&
    !PUBLIC_API.some((p) => pathname.startsWith(p));
  const isAdminPage = pathname.startsWith("/admin") && pathname !== "/admin/login";

  if (!isAdminApi && !isAdminPage) return NextResponse.next();

  // Cookie for the browser, bearer token for the mobile app.
  const bearer = request.headers.get("authorization");
  const token = bearer?.toLowerCase().startsWith("bearer ")
    ? bearer.slice(7).trim()
    : request.cookies.get(SESSION_COOKIE)?.value;

  const claims = await verifySession(token);
  if (claims) {
    // Forward the verified identity to the route. Routes re-verify the
    // token themselves anyway, so this is a convenience, not a trust
    // boundary — any client-supplied x-admin-id is overwritten here.
    const headers = new Headers(request.headers);
    headers.set("x-admin-id", claims.adminId);
    headers.set("x-admin-session", claims.kind);
    return NextResponse.next({ request: { headers } });
  }

  if (isAdminApi) {
    return NextResponse.json(
      { error: "unauthorised", code: "session_invalid" },
      { status: 401 },
    );
  }

  // Build the redirect from the forwarded headers rather than nextUrl.
  //
  // request.nextUrl derives its origin from the Host header, which behind a
  // reverse proxy can be 127.0.0.1:8008 — a machine-local address the browser
  // cannot reach. X-Forwarded-Proto and X-Forwarded-Host carry the address the
  // visitor actually used.
  //
  // NextResponse requires an absolute URL here; a relative Location throws
  // ERR_INVALID_URL and turns every unauthenticated hit into a 500.
  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();

  const proto = forwardedProto || request.nextUrl.protocol.replace(":", "") || "https";
  const host =
    forwardedHost || request.headers.get("host") || request.nextUrl.host;

  let target: URL;
  try {
    target = new URL(
      `/admin/login?next=${encodeURIComponent(pathname)}`,
      `${proto}://${host}`,
    );
  } catch {
    // Malformed or missing host headers — fall back to the request's own URL
    // so the visitor still lands on the login page.
    target = new URL("/admin/login", request.nextUrl.origin);
    target.searchParams.set("next", pathname);
  }

  const response = NextResponse.redirect(target, 307);
  response.headers.set("cache-control", "no-store");
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
