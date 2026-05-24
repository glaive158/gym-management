import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { suspendTenant } from "@/lib/server-actions/tenant-validation";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.PLATFORM_OWNER) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const result = await suspendTenant({
    tenantId: params.id,
    platformOwnerId: ctx.userId,
    prisma,
  });
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
