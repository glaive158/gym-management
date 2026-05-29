import { PrismaClient, PaymentIntentStatus, PaymentMethod, Role } from "@prisma/client";
import { tenantPrisma } from "@/lib/prisma-tenant";
import { assignSubscription } from "@/lib/server-actions/subscription-crud";
import { createPayment } from "@/lib/server-actions/payment-crud";
import { createInvoice, confirmInvoice, type PaydunyaConfig } from "@/lib/paydunya";

export interface InitiatePaymentInput {
  tenantId: string;
  memberId: string;
  planId: string;
  appUrl: string;
  config: PaydunyaConfig;
  prisma: PrismaClient;
}

export interface InitiatePaymentResult {
  success: boolean;
  intentId?: string;
  redirectUrl?: string;
  error?: string;
}

export async function initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
  const scoped = tenantPrisma(input.prisma, input.tenantId);

  const member = await scoped.user.findUnique({ where: { id: input.memberId } });
  if (!member || member.role !== Role.MEMBER) {
    return { success: false, error: "Membre introuvable dans cette organisation" };
  }
  const plan = await scoped.plan.findUnique({ where: { id: input.planId } });
  if (!plan) {
    return { success: false, error: "Formule introuvable dans cette organisation" };
  }

  const intent = await input.prisma.paymentIntent.create({
    data: {
      tenantId: input.tenantId,
      gymId: plan.gymId,
      memberId: input.memberId,
      planId: input.planId,
      amount: plan.price,
      status: PaymentIntentStatus.PENDING,
    },
  });

  const invoice = await createInvoice(input.config, {
    amount: plan.price,
    description: `Abonnement ${plan.name}`,
    customData: { intentId: intent.id },
    callbackUrl: `${input.appUrl}/api/payments/paydunya/callback`,
    returnUrl: `${input.appUrl}/me?payment=success`,
    cancelUrl: `${input.appUrl}/me?payment=cancel`,
  });

  if (!invoice.success || !invoice.token) {
    await input.prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { status: PaymentIntentStatus.FAILED },
    });
    return { success: false, error: invoice.error ?? "Échec création paiement PayDunya" };
  }

  await input.prisma.paymentIntent.update({
    where: { id: intent.id },
    data: { token: invoice.token },
  });

  return { success: true, intentId: intent.id, redirectUrl: invoice.redirectUrl };
}

export interface ConfirmPaymentInput {
  token: string;
  config: PaydunyaConfig;
  prisma: PrismaClient;
}

export async function confirmPayment(input: ConfirmPaymentInput): Promise<{ success: boolean; error?: string }> {
  const intent = await input.prisma.paymentIntent.findUnique({ where: { token: input.token } });
  if (!intent) return { success: false, error: "Paiement introuvable" };

  // Idempotent: already processed.
  if (intent.status === PaymentIntentStatus.COMPLETED) return { success: true };

  const confirmation = await confirmInvoice(input.config, input.token);
  if (!confirmation.success) return { success: false, error: confirmation.error };

  if (confirmation.status === "cancelled") {
    await input.prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { status: PaymentIntentStatus.CANCELLED },
    });
    return { success: true };
  }

  if (confirmation.status !== "completed") {
    // still pending — leave as is, PayDunya will call again
    return { success: true };
  }

  const sub = await assignSubscription({
    tenantId: intent.tenantId,
    memberId: intent.memberId,
    planId: intent.planId,
    prisma: input.prisma,
  });
  if (!sub.success || !sub.subscriptionId) {
    return { success: false, error: sub.error ?? "Échec activation abonnement" };
  }

  const payment = await createPayment({
    tenantId: intent.tenantId,
    gymId: intent.gymId,
    memberId: intent.memberId,
    subscriptionId: sub.subscriptionId,
    amount: intent.amount,
    method: PaymentMethod.PAYDUNYA,
    reference: input.token,
    prisma: input.prisma,
  });
  if (!payment.success) {
    return { success: false, error: payment.error ?? "Échec enregistrement paiement" };
  }

  await input.prisma.paymentIntent.update({
    where: { id: intent.id },
    data: { status: PaymentIntentStatus.COMPLETED, paymentId: payment.paymentId },
  });

  return { success: true };
}
