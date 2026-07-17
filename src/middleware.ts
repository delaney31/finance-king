import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const publicPaths = ["/", "/login", "/register", "/privacy", "/terms", "/api/auth", "/api/health"];

function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname === "/api/health" || pathname.startsWith("/api/health/")) return true;
  return publicPaths.includes(pathname);
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = isPublicPath(pathname);

  if (!req.auth && !isPublic) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (req.auth && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|manifest.json).*)"],
};
