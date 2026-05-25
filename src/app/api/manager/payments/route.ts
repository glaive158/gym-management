import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { createPayment } from "@/lib/server-actions/payment-crud";
import { PaymentMethod, Role } from "@prisma/client";

export async function POST(req: NextRequest) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.MANAGER || !ctx.tenantId || !ctx.gymId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Corps invalide" }, { status: 400 });

  const { memberId, subscriptionId, amount, method, reference, notes } = body;

  if (!memberId || !subscriptionId || !amount || !method) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  const validMethods = Object.values(PaymentMethod);
  if (!validMethods.includes(method)) {
    return NextResponse.json({ error: "Méthode de paiement invalide" }, { status: 400 });
  }

  const result = await createPayment({
    tenantId: ctx.tenantId,
    gymId: ctx.gymId,
    memberId,
    subscriptionId,
    amount: Number(amount),
    method: method as PaymentMethod,
    reference: reference || undefined,
    notes: notes || undefined,
    prisma,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({ paymentId: result.paymentId }, { status: 201 });
}
