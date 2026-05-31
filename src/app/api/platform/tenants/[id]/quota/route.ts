import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.PLATFORM_OWNER) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const quota = Number(body.gymQuota);
  if (!Number.isInteger(quota) || quota < 0 || quota > 1000) {
    return NextResponse.json({ error: "Quota invalide (0–1000)" }, { status: 400 });
  }
  try {
    await prisma.tenant.update({ where: { id: params.id }, data: { gymQuota: quota } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Tenant introuvable" }, { status: 404 });
  }
}
