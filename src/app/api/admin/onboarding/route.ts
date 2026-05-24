import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createFirstGym } from "@/lib/server-actions/create-first-gym";

export async function POST(req: Request) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.TENANT_ADMIN || !ctx.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const result = await createFirstGym({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    name: String(body.name ?? ""),
    address: String(body.address ?? ""),
    city: String(body.city ?? ""),
    phone: String(body.phone ?? ""),
    latitude: Number(body.latitude),
    longitude: Number(body.longitude),
    prisma,
  });
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, gymId: result.gymId });
}
