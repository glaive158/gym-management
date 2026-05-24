import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { rejectTenant } from "@/lib/server-actions/tenant-validation";
import { sendEmail, buildRejectionEmail } from "@/lib/email";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.PLATFORM_OWNER) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const reason = String(body.reason ?? "");
  const result = await rejectTenant({
    tenantId: params.id,
    platformOwnerId: ctx.userId,
    reason,
    prisma,
  });
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: params.id } });
  const owner = await prisma.user.findFirst({
    where: { tenantId: params.id, role: Role.TENANT_ADMIN },
  });
  if (tenant && owner) {
    const email = buildRejectionEmail({
      recipientName: owner.name,
      organizationName: tenant.name,
      reason,
    });
    await sendEmail({ to: owner.email, ...email });
  }

  return NextResponse.json({ ok: true });
}
