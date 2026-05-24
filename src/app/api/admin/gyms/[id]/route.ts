import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { updateGym, deleteGym } from "@/lib/server-actions/gym-crud";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.TENANT_ADMIN || !ctx.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const r = await updateGym({
    tenantId: ctx.tenantId, gymId: params.id,
    name: body.name, address: body.address, city: body.city, phone: body.phone,
    latitude: body.latitude !== undefined ? Number(body.latitude) : undefined,
    longitude: body.longitude !== undefined ? Number(body.longitude) : undefined,
    prisma,
  });
  if (!r.success) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.TENANT_ADMIN || !ctx.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const r = await deleteGym({ tenantId: ctx.tenantId, gymId: params.id, prisma });
  if (!r.success) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
