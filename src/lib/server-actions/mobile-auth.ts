import { PrismaClient, Role, UserStatus } from "@prisma/client";
import { verifyPassword } from "@/lib/password";
import { signMobileToken } from "@/lib/jwt-mobile";

export interface LoginMobileResult {
  success: boolean;
  token?: string;
  user?: { id: string; name: string; email: string; avatar: string | null };
  error?: string;
}

export async function loginMobile(input: {
  email: string;
  password: string;
  secret: string;
  prisma: PrismaClient;
}): Promise<LoginMobileResult> {
  const user = await input.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (!user || !user.passwordHash) return { success: false, error: "Identifiants invalides" };
  if (user.status !== UserStatus.ACTIVE) return { success: false, error: "Compte non actif" };
  if (user.role !== Role.MEMBER) return { success: false, error: "Application réservée aux membres" };

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) return { success: false, error: "Identifiants invalides" };

  const token = await signMobileToken(
    { userId: user.id, role: user.role, tenantId: user.tenantId },
    input.secret
  );
  return {
    success: true,
    token,
    user: { id: user.id, name: user.name, email: user.email ?? "", avatar: user.avatar },
  };
}
