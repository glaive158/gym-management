import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { updateMember } from "@/lib/server-actions/member-crud";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.MANAGER || !ctx.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const r = await updateMember({
    tenantId: ctx.tenantId, memberId: params.id,
    name: body.name, phone: body.phone, avatar: body.avatar, prisma,
  });
  if (!r.success) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
