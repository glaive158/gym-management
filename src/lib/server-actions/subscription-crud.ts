import { PrismaClient, SubscriptionStatus, Role } from "@prisma/client";
import { tenantPrisma } from "@/lib/prisma-tenant";

export interface AssignSubscriptionInput {
  tenantId: string;
  memberId: string;
  planId: string;
  startDate?: Date;
  autoRenew?: boolean;
  prisma: PrismaClient;
}

export async function assignSubscription(
  input: AssignSubscriptionInput
): Promise<{ success: boolean; subscriptionId?: string; error?: string }> {
  const scoped = tenantPrisma(input.prisma, input.tenantId);

  const member = await scoped.user.findUnique({ where: { id: input.memberId } });
  if (!member || member.role !== Role.MEMBER) {
    return { success: false, error: "Membre introuvable dans cette organisation" };
  }

  const plan = await scoped.plan.findUnique({ where: { id: input.planId } });
  if (!plan) {
    return { success: false, error: "Formule introuvable dans cette organisation" };
  }

  const startDate = input.startDate ?? new Date();
  const endDate = new Date(startDate.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

  const sub = await scoped.subscription.create({
    data: {
      memberId: input.memberId,
      planId: input.planId,
      startDate,
      endDate,
      status: SubscriptionStatus.ACTIVE,
      autoRenew: input.autoRenew ?? false,
    } as any,
  });

  return { success: true, subscriptionId: sub.id };
}

export interface CancelSubscriptionInput {
  tenantId: string;
  subscriptionId: string;
  prisma: PrismaClient;
}

export async function cancelSubscription(
  input: CancelSubscriptionInput
): Promise<{ success: boolean; error?: string }> {
  const scoped = tenantPrisma(input.prisma, input.tenantId);
  try {
    await scoped.subscription.update({
      where: { id: input.subscriptionId },
      data: { status: SubscriptionStatus.CANCELLED },
    });
    return { success: true };
  } catch {
    return { success: false, error: "Abonnement introuvable" };
  }
}
