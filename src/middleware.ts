import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { Role } from "@prisma/client";

const PUBLIC_PATHS = ["/", "/login", "/signup", "/activate", "/checkin"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

const ROUTE_ROLES: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: "/platform", roles: [Role.PLATFORM_OWNER] },
  { prefix: "/admin", roles: [Role.TENANT_ADMIN] },
  { prefix: "/manager", roles: [Role.MANAGER] },
  { prefix: "/me", roles: [Role.MEMBER] },
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/favicon") ||
    isPublic(pathname)
  ) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  const match = ROUTE_ROLES.find((r) => pathname.startsWith(r.prefix));
  if (match && !match.roles.includes(token.role as Role)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "forbidden");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
