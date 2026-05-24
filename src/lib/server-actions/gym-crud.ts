import { z } from "zod";
import { PrismaClient, Gym } from "@prisma/client";
import { tenantPrisma } from "@/lib/prisma-tenant";

const GymBaseSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  address: z.string().min(1, "Adresse requise"),
  city: z.string().min(1, "Ville requise"),
  phone: z.string().min(5, "Téléphone requis"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const GymUpdateSchema = GymBaseSchema.partial();

export interface CreateGymInput {
  tenantId: string;
  prisma: PrismaClient;
  name: string;
  address: string;
  city: string;
  phone: string;
  latitude: number;
  longitude: number;
}

export async function createGym(input: CreateGymInput): Promise<{ success: boolean; gymId?: string; error?: string }> {
  const parsed = GymBaseSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const client = tenantPrisma(input.prisma, input.tenantId);
  const gym = await client.gym.create({ data: parsed.data });
  return { success: true, gymId: gym.id };
}

export interface ListGymsInput {
  tenantId: string;
  prisma: PrismaClient;
}

export async function listGyms(input: ListGymsInput): Promise<Gym[]> {
  const client = tenantPrisma(input.prisma, input.tenantId);
  return client.gym.findMany({ orderBy: { name: "asc" } });
}

export interface UpdateGymInput {
  tenantId: string;
  gymId: string;
  prisma: PrismaClient;
  name?: string;
  address?: string;
  city?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
}

export async function updateGym(input: UpdateGymInput): Promise<{ success: boolean; error?: string }> {
  const parsed = GymUpdateSchema.safeParse({
    name: input.name, address: input.address, city: input.city,
    phone: input.phone, latitude: input.latitude, longitude: input.longitude,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const client = tenantPrisma(input.prisma, input.tenantId);
  try {
    await client.gym.update({ where: { id: input.gymId }, data: parsed.data });
    return { success: true };
  } catch {
    return { success: false, error: "Salle introuvable" };
  }
}

export interface DeleteGymInput {
  tenantId: string;
  gymId: string;
  prisma: PrismaClient;
}

export async function deleteGym(input: DeleteGymInput): Promise<{ success: boolean; error?: string }> {
  const client = tenantPrisma(input.prisma, input.tenantId);
  try {
    await client.gym.delete({ where: { id: input.gymId } });
    return { success: true };
  } catch {
    return { success: false, error: "Salle introuvable" };
  }
}
