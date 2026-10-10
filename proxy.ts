/**
 * Request gate for page routes.
 *
 * Cookie-presence redirect only; see `proxy` for why it is not a security
 * boundary.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

/**
 * Cookie-presence gate for page routes.
 *
 * This is a redirect convenience only. It cannot replace the Flask permission
 * checks and it is not a security boundary: the BFF route handlers re-validate
 * the encrypted session and attach tokens, and Flask still authorises every
 * request.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Never redirect the API boundary or Next internals.
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/login" ||
    pathname === "/unauthorized" ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);

  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // Preserve the intended destination so sign-in can return there.
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all page routes except:
     * - api (the BFF boundary)
     * - _next/static, _next/image, _next/data (build output)
     * - favicon.ico and other public files with an extension
     */
    "/((?!api|_next/static|_next/image|_next/data|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json)$).*)",
  ],
};
