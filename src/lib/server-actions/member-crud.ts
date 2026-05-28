import { z } from "zod";
import { PrismaClient, Role, User, UserStatus } from "@prisma/client";
import { tenantPrisma } from "@/lib/prisma-tenant";
import { hashPassword } from "@/lib/password";

const MemberSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  email: z.string().email("Email invalide"),
  phone: z.string().min(5, "Téléphone requis"),
  avatar: z.string().min(1, "Photo membre requise pour l'anti-fraude"),
  password: z.string().min(8, "Mot de passe trop court (8 caractères minimum)"),
});

const MemberUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(5).optional(),
  avatar: z.string().min(1).optional(),
});

export interface CreateMemberInput {
  tenantId: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  password: string;
  prisma: PrismaClient;
}

export async function createMember(
  input: CreateMemberInput
): Promise<{ success: boolean; userId?: string; error?: string }> {
  const parsed = MemberSchema.safeParse({
    name: input.name, email: input.email, phone: input.phone, avatar: input.avatar, password: input.password,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await input.prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { success: false, error: "Cet email est déjà utilisé" };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const scoped = tenantPrisma(input.prisma, input.tenantId);
  const member = await scoped.user.create({
    data: {
      name: parsed.data.name,
      email,
      phone: parsed.data.phone,
      avatar: parsed.data.avatar,
      passwordHash,
      role: Role.MEMBER,
      status: UserStatus.ACTIVE,
      passwordSetAt: new Date(),
      mustChangePassword: true,
    },
  });

  return { success: true, userId: member.id };
}

export interface ListMembersInput {
  tenantId: string;
  search?: string;
  prisma: PrismaClient;
}

export async function listMembers(input: ListMembersInput): Promise<User[]> {
  const scoped = tenantPrisma(input.prisma, input.tenantId);
  const search = input.search?.trim();
  return scoped.user.findMany({
    where: {
      role: Role.MEMBER,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
  });
}

export interface GetMemberInput {
  tenantId: string;
  memberId: string;
  prisma: PrismaClient;
}

export async function getMember(input: GetMemberInput): Promise<User | null> {
  const scoped = tenantPrisma(input.prisma, input.tenantId);
  const u = await scoped.user.findUnique({ where: { id: input.memberId } });
  if (!u || u.role !== Role.MEMBER) return null;
  return u;
}

export interface UpdateMemberInput {
  tenantId: string;
  memberId: string;
  name?: string;
  phone?: string;
  avatar?: string;
  prisma: PrismaClient;
}

export async function updateMember(input: UpdateMemberInput): Promise<{ success: boolean; error?: string }> {
  const parsed = MemberUpdateSchema.safeParse({
    name: input.name, phone: input.phone, avatar: input.avatar,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const scoped = tenantPrisma(input.prisma, input.tenantId);
  try {
    await scoped.user.update({ where: { id: input.memberId }, data: parsed.data });
    return { success: true };
  } catch {
    return { success: false, error: "Membre introuvable" };
  }
}
