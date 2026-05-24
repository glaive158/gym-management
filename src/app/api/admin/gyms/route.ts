import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createGym } from "@/lib/server-actions/gym-crud";

export async function POST(req: Request) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.TENANT_ADMIN || !ctx.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const r = await createGym({
    tenantId: ctx.tenantId,
    name: String(body.name ?? ""),
    address: String(body.address ?? ""),
    city: String(body.city ?? ""),
    phone: String(body.phone ?? ""),
    latitude: Number(body.latitude),
    longitude: Number(body.longitude),
    prisma,
  });
  if (!r.success) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true, gymId: r.gymId });
}
