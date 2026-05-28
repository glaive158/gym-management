import { z } from "zod";
import { PrismaClient, Role, User, UserStatus } from "@prisma/client";
import { tenantPrisma } from "@/lib/prisma-tenant";
import { hashPassword } from "@/lib/password";

const ManagerSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  email: z.string().email("Email invalide"),
  phone: z.string().min(5, "Téléphone requis"),
  password: z.string().min(8, "Mot de passe trop court (8 caractères minimum)"),
});

export interface CreateManagerInput {
  tenantId: string;
  gymId: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  prisma: PrismaClient;
}

export async function createManager(
  input: CreateManagerInput
): Promise<{ success: boolean; userId?: string; activationUrl?: string; error?: string }> {
  const parsed = ManagerSchema.safeParse({
    name: input.name,
    email: input.email,
    phone: input.phone,
    password: input.password,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await input.prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { success: false, error: "Cet email est déjà utilisé" };
  }

  const scoped = tenantPrisma(input.prisma, input.tenantId);
  const gym = await scoped.gym.findUnique({ where: { id: input.gymId } });
  if (!gym) {
    return { success: false, error: "Salle introuvable dans cette organisation" };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await scoped.user.create({
    data: {
      name: parsed.data.name,
      email,
      phone: parsed.data.phone,
      passwordHash,
      role: Role.MANAGER,
      status: UserStatus.ACTIVE,
      gymId: input.gymId,
      passwordSetAt: new Date(),
    },
  });

  return { success: true, userId: user.id };
}

export interface ListManagersInput {
  tenantId: string;
  prisma: PrismaClient;
}

export async function listManagers(input: ListManagersInput): Promise<User[]> {
  const scoped = tenantPrisma(input.prisma, input.tenantId);
  return scoped.user.findMany({
    where: { role: Role.MANAGER },
    orderBy: { name: "asc" },
  });
}

export interface DeactivateManagerInput {
  tenantId: string;
  managerId: string;
  prisma: PrismaClient;
}

export async function deactivateManager(input: DeactivateManagerInput): Promise<{ success: boolean; error?: string }> {
  const scoped = tenantPrisma(input.prisma, input.tenantId);
  try {
    await scoped.user.update({
      where: { id: input.managerId },
      data: { status: UserStatus.SUSPENDED },
    });
    return { success: true };
  } catch {
    return { success: false, error: "Manager introuvable" };
  }
}
