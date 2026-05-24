import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { updatePlan, deactivatePlan } from "@/lib/server-actions/plan-crud";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.MANAGER || !ctx.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const r = await updatePlan({
    tenantId: ctx.tenantId, planId: params.id,
    name: body.name, durationDays: body.durationDays !== undefined ? Number(body.durationDays) : undefined,
    price: body.price !== undefined ? Number(body.price) : undefined,
    prisma,
  });
  if (!r.success) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.MANAGER || !ctx.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const r = await deactivatePlan({ tenantId: ctx.tenantId, planId: params.id, prisma });
  if (!r.success) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
