import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "gamex_session";

const PROTECTED_PREFIXES = ["/pos", "/admin", "/reports", "/invoices"];

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  const requiresAuth = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!requiresAuth) {
    return NextResponse.next();
  }

  // Presence-only check: the session is fully verified against the
  // database by requireAuth() in route handlers and server components.
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (sessionToken) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Skip /login, /api/*, Next.js internals, and static assets.
  matcher: ["/((?!login|api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons|.*\\.(?:png|svg|ico|webmanifest|js\\.map)$).*)"],
};
