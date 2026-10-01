import { NextResponse, type NextRequest } from "next/server";

import { AUTH_TOKEN_STORAGE_KEY } from "@/lib/auth";

const guestOnlyAuthRoutes = ["/login", "/register", "/forgot-password"];

export function middleware(request: NextRequest) {
  const token = request.cookies.get(AUTH_TOKEN_STORAGE_KEY)?.value;
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/dashboard") && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);

    return NextResponse.redirect(loginUrl);
  }

  // Reset links must remain accessible even when the user already has an active session.
  // This is especially important when the reset request is sent from dashboard/settings.
  if (token && guestOnlyAuthRoutes.includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/register", "/forgot-password", "/reset-password"],
};
