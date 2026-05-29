import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { paydunyaConfigFromEnv } from "@/lib/paydunya";
import { initiatePayment } from "@/lib/server-actions/paydunya-payments";

export async function POST(req: Request) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || !ctx.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = paydunyaConfigFromEnv();
  if (!config) {
    return NextResponse.json({ error: "PayDunya non configuré" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const planId = String(body.planId ?? "");

  // Member pays for self; manager initiates for a given member.
  let memberId: string;
  if (ctx.role === Role.MEMBER) {
    memberId = ctx.userId;
  } else if (ctx.role === Role.MANAGER) {
    memberId = String(body.memberId ?? "");
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!memberId || !planId) {
    return NextResponse.json({ error: "memberId et planId requis" }, { status: 400 });
  }

  const r = await initiatePayment({
    tenantId: ctx.tenantId,
    memberId,
    planId,
    appUrl: process.env.APP_URL ?? "",
    config,
    prisma,
  });
  if (!r.success) return NextResponse.json({ error: r.error }, { status: 400 });

  return NextResponse.json({ redirectUrl: r.redirectUrl });
}
