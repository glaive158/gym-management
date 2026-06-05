import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { authMobileRequest } from "@/lib/mobile-auth-context";
import { getFitnessData } from "@/lib/server-actions/fitness-tracking";

export const dynamic = "force-dynamic";

async function resolve(req: Request) {
  const ctx = await getCurrentAuthContext();
  if (ctx?.userId) return { userId: ctx.userId, tenantId: ctx.tenantId ?? null };
  const mobile = await authMobileRequest(req);
  if (!mobile) return null;
  const u = await prisma.user.findUnique({ where: { id: mobile.userId }, select: { id: true, tenantId: true } });
  if (!u) return null;
  return { userId: u.id, tenantId: u.tenantId };
}

export async function GET(req: Request) {
  const who = await resolve(req);
  if (!who) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!who.tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });
  const r = await getFitnessData({ memberId: who.userId, tenantId: who.tenantId, prisma });
  if (!r.success) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json(r.data);
}
