import { z } from "zod";
import { PrismaClient, Role, User, UserStatus } from "@prisma/client";
import { tenantPrisma } from "@/lib/prisma-tenant";
import { hashPassword } from "@/lib/password";

const MemberSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  email: z.string().email("Email invalide").optional(),
  phone: z.string().min(5, "Téléphone requis"),
  avatar: z.string().min(1, "Photo membre requise pour l'anti-fraude"),
  password: z.string().min(8, "Mot de passe trop court (8 caractères minimum)").optional(),
});

const MemberUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(5).optional(),
  avatar: z.string().min(1).optional(),
});

export interface CreateMemberInput {
  tenantId: string;
  name: string;
  email?: string;
  phone: string;
  avatar: string;
  password?: string;
  prisma: PrismaClient;
}

export async function createMember(
  input: CreateMemberInput
): Promise<{ success: boolean; userId?: string; error?: string }> {
  // Empty strings from form bodies are treated as "not provided".
  const rawEmail = input.email?.trim() ? input.email.trim() : undefined;
  const rawPassword = input.password?.trim() ? input.password : undefined;

  const parsed = MemberSchema.safeParse({
    name: input.name, email: rawEmail, phone: input.phone, avatar: input.avatar, password: rawPassword,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const email = parsed.data.email ? parsed.data.email.toLowerCase() : null;
  if (email) {
    const existing = await input.prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { success: false, error: "Cet email est déjà utilisé" };
    }
  }

  // A member can log in only if it has a password; without one it is a
  // manager-managed record (check-in by staff, no app access).
  const passwordHash = parsed.data.password ? await hashPassword(parsed.data.password) : null;
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
      passwordSetAt: passwordHash ? new Date() : null,
      mustChangePassword: passwordHash != null,
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
      status: { not: UserStatus.SUSPENDED },
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

export interface DeactivateMemberInput {
  tenantId: string;
  memberId: string;
  prisma: PrismaClient;
}

// Soft-delete: keep the member row (and its payment / check-in history) but
// flip status to SUSPENDED so it disappears from the members list. Also free
// the email so a new member can be created with the same address; the
// previous one stays linked to its history through its id.
export async function deactivateMember(input: DeactivateMemberInput): Promise<{ success: boolean; error?: string }> {
  const scoped = tenantPrisma(input.prisma, input.tenantId);
  try {
    await scoped.user.update({
      where: { id: input.memberId },
      data: {
        status: UserStatus.SUSPENDED,
        email: null,
        activationToken: null,
      },
    });
    return { success: true };
  } catch {
    return { success: false, error: "Membre introuvable" };
  }
}
