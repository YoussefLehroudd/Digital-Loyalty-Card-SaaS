import { NextResponse, type NextRequest } from "next/server";

import { AUTH_TOKEN_STORAGE_KEY } from "@/lib/auth";

const guestOnlyAuthRoutes = ["/login", "/register"];

export function middleware(request: NextRequest) {
  const token = request.cookies.get(AUTH_TOKEN_STORAGE_KEY)?.value;
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/r/")) {
    const code = pathname.slice(3);
    if (!/^[a-z0-9][a-z0-9-]{2,47}$/.test(code)) return NextResponse.redirect(new URL("/register", request.url));
    return NextResponse.rewrite(new URL(`/api/referrals/${code}`, request.url));
  }
  if ((pathname === "/admin" || pathname.startsWith("/admin/")) && pathname !== "/admin/login" && !request.cookies.get("loyvance_admin_token")?.value) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  if (pathname.startsWith("/dashboard") && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);

    return NextResponse.redirect(loginUrl);
  }

  // Password recovery and reset links stay accessible during an active session.
  // This is especially important when the reset request is sent from dashboard/settings.
  if (token && guestOnlyAuthRoutes.includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/r/:path*", "/admin/:path*", "/dashboard/:path*", "/login", "/register", "/forgot-password", "/reset-password"],
};
