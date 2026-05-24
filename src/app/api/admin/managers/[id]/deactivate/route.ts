import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deactivateManager } from "@/lib/server-actions/manager-crud";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.TENANT_ADMIN || !ctx.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const r = await deactivateManager({ tenantId: ctx.tenantId, managerId: params.id, prisma });
  if (!r.success) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
