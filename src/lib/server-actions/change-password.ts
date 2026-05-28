import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { hashPassword, verifyPassword } from "@/lib/password";

const NewPasswordSchema = z.string().min(8, "Mot de passe trop court (8 caractères minimum)");

export interface ChangePasswordInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
  prisma: PrismaClient;
}

export interface ChangePasswordResult {
  success: boolean;
  error?: string;
}

export async function changePassword(input: ChangePasswordInput): Promise<ChangePasswordResult> {
  const check = NewPasswordSchema.safeParse(input.newPassword);
  if (!check.success) {
    return { success: false, error: check.error.issues[0]?.message ?? "Mot de passe invalide" };
  }

  const user = await input.prisma.user.findUnique({ where: { id: input.userId } });
  if (!user || !user.passwordHash) {
    return { success: false, error: "Utilisateur introuvable" };
  }

  const ok = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!ok) {
    return { success: false, error: "Mot de passe actuel incorrect" };
  }

  const passwordHash = await hashPassword(input.newPassword);
  await input.prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordSetAt: new Date(),
      mustChangePassword: false,
    },
  });

  return { success: true };
}
