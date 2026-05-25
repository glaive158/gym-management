import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loginMobile } from "@/lib/server-actions/mobile-auth";

export async function POST(req: Request) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  const body = await req.json();
  const r = await loginMobile({
    email: String(body.email ?? ""),
    password: String(body.password ?? ""),
    secret,
    prisma,
  });
  if (!r.success) return NextResponse.json({ error: r.error }, { status: 401 });
  return NextResponse.json({ token: r.token, user: r.user });
}
