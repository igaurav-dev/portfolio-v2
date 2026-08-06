import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminApi =
    pathname.startsWith("/api/admin") && !pathname.startsWith("/api/admin/login");
  const isAdminPage = pathname.startsWith("/admin") && pathname !== "/admin/login";

  if (!isAdminApi && !isAdminPage) return NextResponse.next();

  const ok = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (ok) return NextResponse.next();

  if (isAdminApi) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/admin/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
