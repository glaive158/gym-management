import { PrismaClient, PaymentMethod, Role } from "@prisma/client";
import { tenantPrisma } from "@/lib/prisma-tenant";

export interface CreatePaymentInput {
  tenantId: string;
  gymId: string;
  memberId: string;
  subscriptionId: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
  paidAt?: Date;
  prisma: PrismaClient;
}

export interface CreatePaymentResult {
  success: boolean;
  paymentId?: string;
  error?: string;
}

export async function createPayment(
  input: CreatePaymentInput
): Promise<CreatePaymentResult> {
  const scoped = tenantPrisma(input.prisma, input.tenantId);

  if (input.amount <= 0) {
    return { success: false, error: "Le montant doit être positif" };
  }

  const member = await scoped.user.findUnique({ where: { id: input.memberId } });
  if (!member || member.role !== Role.MEMBER) {
    return { success: false, error: "Membre introuvable dans cette organisation" };
  }

  const sub = await scoped.subscription.findUnique({ where: { id: input.subscriptionId } });
  if (!sub || sub.memberId !== input.memberId) {
    return { success: false, error: "Abonnement introuvable ou ne correspond pas au membre" };
  }

  const payment = await scoped.payment.create({
    data: {
      gymId: input.gymId,
      memberId: input.memberId,
      subscriptionId: input.subscriptionId,
      amount: Math.round(input.amount),
      method: input.method,
      reference: input.reference ?? null,
      notes: input.notes ?? null,
      paidAt: input.paidAt ?? new Date(),
    } as any,
  });

  return { success: true, paymentId: payment.id };
}

export interface ListPaymentsInput {
  tenantId: string;
  gymId?: string;
  memberId?: string;
  prisma: PrismaClient;
}

export interface PaymentSummary {
  id: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  paidAt: Date;
  memberName: string;
  memberAvatar: string | null;
  subscriptionId: string;
}

export async function listPayments(
  input: ListPaymentsInput
): Promise<PaymentSummary[]> {
  const scoped = tenantPrisma(input.prisma, input.tenantId);
  const where: Record<string, unknown> = {};
  if (input.gymId) where.gymId = input.gymId;
  if (input.memberId) where.memberId = input.memberId;

  const payments = await scoped.payment.findMany({
    where,
    include: { member: { select: { name: true, avatar: true } } },
    orderBy: { paidAt: "desc" },
  });

  return payments.map((p: any) => ({
    id: p.id,
    amount: p.amount,
    currency: p.currency,
    method: p.method,
    reference: p.reference,
    notes: p.notes,
    paidAt: p.paidAt,
    memberName: p.member.name,
    memberAvatar: p.member.avatar,
    subscriptionId: p.subscriptionId,
  }));
}

export interface MonthlyTotal {
  total: number;
  count: number;
}

export async function getMonthlyPaymentTotal(input: {
  tenantId: string;
  gymId: string;
  year: number;
  month: number;
  prisma: PrismaClient;
}): Promise<MonthlyTotal> {
  const start = new Date(input.year, input.month - 1, 1);
  const end = new Date(input.year, input.month, 1);

  const scoped = tenantPrisma(input.prisma, input.tenantId);
  const payments = await scoped.payment.findMany({
    where: {
      gymId: input.gymId,
      paidAt: { gte: start, lt: end },
    },
    select: { amount: true },
  });

  return {
    total: payments.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0),
    count: payments.length,
  };
}
