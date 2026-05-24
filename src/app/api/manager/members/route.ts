import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createMember } from "@/lib/server-actions/member-crud";
import { sendEmail, buildActivationEmail } from "@/lib/email";

export async function POST(req: Request) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.MANAGER || !ctx.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const r = await createMember({
    tenantId: ctx.tenantId,
    name: String(body.name ?? ""),
    email: String(body.email ?? ""),
    phone: String(body.phone ?? ""),
    avatar: String(body.avatar ?? ""),
    prisma,
  });
  if (!r.success) return NextResponse.json({ error: r.error }, { status: 400 });

  if (r.activationUrl) {
    const email = buildActivationEmail({
      recipientName: String(body.name),
      activationUrl: r.activationUrl,
    });
    await sendEmail({ to: String(body.email).toLowerCase(), ...email });
  }

  return NextResponse.json({ ok: true, userId: r.userId, activationUrl: r.activationUrl });
}
