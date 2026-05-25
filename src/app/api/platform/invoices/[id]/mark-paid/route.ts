import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role, TenantPaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { markInvoicePaid } from "@/lib/server-actions/billing";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.PLATFORM_OWNER) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const method = String(body.method ?? "MANUAL_TRANSFER") as TenantPaymentMethod;
  if (!Object.values(TenantPaymentMethod).includes(method)) return NextResponse.json({ error: "Méthode invalide" }, { status: 400 });
  const r = await markInvoicePaid({
    invoiceId: params.id,
    method,
    externalRef: body.externalRef ? String(body.externalRef) : undefined,
    recordedById: ctx.userId,
    prisma,
  });
  if (!r.success) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
