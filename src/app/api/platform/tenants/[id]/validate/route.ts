import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { validateTenant } from "@/lib/server-actions/tenant-validation";
import { sendEmail, buildActivationEmail } from "@/lib/email";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.PLATFORM_OWNER) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const result = await validateTenant({
    tenantId: params.id,
    platformOwnerId: ctx.userId,
    prisma,
  });
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const owner = await prisma.user.findFirst({
    where: { tenantId: params.id, role: Role.TENANT_ADMIN },
  });
  if (owner?.email && result.activationUrl) {
    const email = buildActivationEmail({
      recipientName: owner.name,
      activationUrl: result.activationUrl,
    });
    await sendEmail({ to: owner.email, ...email });
  }

  return NextResponse.json({ ok: true, activationUrl: result.activationUrl });
}
