import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/lib/auth";

// Routes that require *some* logged-in user.
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/projects/new",
  "/profile",
  "/contracts",
  "/messages",
  "/notifications",
];

function getSecret() {
  return new TextEncoder().encode(process.env.SESSION_SECRET ?? "");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const needsAuth = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!needsAuth) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const { payload } = await jwtVerify(token, getSecret());

    // Role-gate specific areas at the edge; each route/API also re-checks
    // this server-side, so this is a UX shortcut, not the only guard.
    if (pathname.startsWith("/dashboard/client") && payload.role !== "CLIENT") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    if (
      pathname.startsWith("/dashboard/developer") &&
      payload.role !== "DEVELOPER"
    ) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    if (pathname.startsWith("/projects/new") && payload.role !== "CLIENT") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    if (pathname.startsWith("/profile") && payload.role !== "DEVELOPER") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  } catch {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/projects/new",
    "/profile/:path*",
    "/contracts/:path*",
    "/messages/:path*",
    "/notifications/:path*",
  ],
};
