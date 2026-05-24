import { z } from "zod";
import { PrismaClient, TenantStatus } from "@prisma/client";

const GymSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  address: z.string().min(1, "Adresse requise"),
  city: z.string().min(1, "Ville requise"),
  phone: z.string().min(5, "Téléphone requis"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export interface CreateFirstGymInput {
  tenantId: string;
  userId: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  latitude: number;
  longitude: number;
  prisma: PrismaClient;
}

export async function createFirstGym(
  input: CreateFirstGymInput
): Promise<{ success: boolean; gymId?: string; error?: string }> {
  const parsed = GymSchema.safeParse({
    name: input.name, address: input.address, city: input.city,
    phone: input.phone, latitude: input.latitude, longitude: input.longitude,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const tenant = await input.prisma.tenant.findUnique({ where: { id: input.tenantId } });
  if (!tenant) return { success: false, error: "Tenant introuvable" };
  if (tenant.status !== TenantStatus.ACTIVE) {
    return { success: false, error: "Tenant non actif" };
  }

  const gym = await input.prisma.gym.create({
    data: { tenantId: input.tenantId, ...parsed.data },
  });

  return { success: true, gymId: gym.id };
}
