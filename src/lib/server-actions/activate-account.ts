import { z } from "zod";
import { PrismaClient, UserStatus } from "@prisma/client";
import { hashPassword } from "@/lib/password";
import { isTokenExpired } from "@/lib/activation-token";

const PasswordSchema = z.string().min(8, "Mot de passe trop court (8 caractères minimum)");

export interface ActivateAccountInput {
  token: string;
  password: string;
  prisma: PrismaClient;
}

export interface ActivateAccountResult {
  success: boolean;
  userId?: string;
  error?: string;
}

export async function activateAccount(input: ActivateAccountInput): Promise<ActivateAccountResult> {
  const passCheck = PasswordSchema.safeParse(input.password);
  if (!passCheck.success) {
    return { success: false, error: passCheck.error.issues[0]?.message ?? "Mot de passe invalide" };
  }

  const user = await input.prisma.user.findUnique({ where: { activationToken: input.token } });
  if (!user) {
    return { success: false, error: "Lien d'activation invalide" };
  }

  if (isTokenExpired(user.activationTokenExpiresAt)) {
    return { success: false, error: "Lien d'activation expiré" };
  }

  const passwordHash = await hashPassword(input.password);

  await input.prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      status: UserStatus.ACTIVE,
      activationToken: null,
      activationTokenExpiresAt: null,
      passwordSetAt: new Date(),
    },
  });

  return { success: true, userId: user.id };
}
