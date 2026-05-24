import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { activateAccount } from "@/lib/server-actions/activate-account";

export async function POST(req: Request) {
  const body = await req.json();
  const result = await activateAccount({
    token: String(body.token ?? ""),
    password: String(body.password ?? ""),
    prisma,
  });
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
