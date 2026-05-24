import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createPlan } from "@/lib/server-actions/plan-crud";

export async function POST(req: Request) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.MANAGER || !ctx.tenantId || !ctx.gymId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const r = await createPlan({
    tenantId: ctx.tenantId, gymId: ctx.gymId,
    name: String(body.name ?? ""),
    durationDays: Number(body.durationDays),
    price: Number(body.price),
    prisma,
  });
  if (!r.success) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true, planId: r.planId });
}
