import { z } from "zod";
import { PrismaClient, Plan } from "@prisma/client";
import { tenantPrisma } from "@/lib/prisma-tenant";

const PlanSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  durationDays: z.number().int().positive("Durée invalide"),
  price: z.number().int().positive("Prix invalide"),
  currency: z.string().default("XOF"),
});

const PlanUpdateSchema = PlanSchema.partial();

export interface CreatePlanInput {
  tenantId: string;
  gymId: string;
  name: string;
  durationDays: number;
  price: number;
  currency?: string;
  prisma: PrismaClient;
}

export async function createPlan(input: CreatePlanInput): Promise<{ success: boolean; planId?: string; error?: string }> {
  const parsed = PlanSchema.safeParse({
    name: input.name, durationDays: input.durationDays,
    price: input.price, currency: input.currency,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const scoped = tenantPrisma(input.prisma, input.tenantId);
  const gym = await scoped.gym.findUnique({ where: { id: input.gymId } });
  if (!gym) return { success: false, error: "Salle introuvable dans cette organisation" };

  const plan = await scoped.plan.create({
    data: { gymId: input.gymId, ...parsed.data } as any,
  });
  return { success: true, planId: plan.id };
}

export interface ListPlansInput {
  tenantId: string;
  gymId: string;
  prisma: PrismaClient;
  includeInactive?: boolean;
}

export async function listPlans(input: ListPlansInput): Promise<Plan[]> {
  const scoped = tenantPrisma(input.prisma, input.tenantId);
  return scoped.plan.findMany({
    where: {
      gymId: input.gymId,
      ...(input.includeInactive ? {} : { isActive: true }),
    },
    orderBy: { durationDays: "asc" },
  });
}

export interface UpdatePlanInput {
  tenantId: string;
  planId: string;
  name?: string;
  durationDays?: number;
  price?: number;
  prisma: PrismaClient;
}

export async function updatePlan(input: UpdatePlanInput): Promise<{ success: boolean; error?: string }> {
  const parsed = PlanUpdateSchema.safeParse({
    name: input.name, durationDays: input.durationDays, price: input.price,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const scoped = tenantPrisma(input.prisma, input.tenantId);
  try {
    await scoped.plan.update({ where: { id: input.planId }, data: parsed.data });
    return { success: true };
  } catch {
    return { success: false, error: "Formule introuvable" };
  }
}

export interface DeactivatePlanInput {
  tenantId: string;
  planId: string;
  prisma: PrismaClient;
}

export async function deactivatePlan(input: DeactivatePlanInput): Promise<{ success: boolean; error?: string }> {
  const scoped = tenantPrisma(input.prisma, input.tenantId);
  try {
    await scoped.plan.update({ where: { id: input.planId }, data: { isActive: false } });
    return { success: true };
  } catch {
    return { success: false, error: "Formule introuvable" };
  }
}
