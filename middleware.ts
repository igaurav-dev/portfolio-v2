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

  const url = request.nextUrl.clone();
  url.pathname = "/admin/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
