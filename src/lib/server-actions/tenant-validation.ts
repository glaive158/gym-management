import { PrismaClient, TenantStatus } from "@prisma/client";
import { generateActivationToken } from "@/lib/activation-token";

const TRIAL_DAYS = 14;

export interface ValidateTenantInput {
  tenantId: string;
  platformOwnerId: string;
  prisma: PrismaClient;
  appUrl?: string;
}

export interface ValidateTenantResult {
  success: boolean;
  activationUrl?: string;
  error?: string;
}

export async function validateTenant(input: ValidateTenantInput): Promise<ValidateTenantResult> {
  const tenant = await input.prisma.tenant.findUnique({ where: { id: input.tenantId } });
  if (!tenant) return { success: false, error: "Tenant introuvable" };
  if (tenant.status !== TenantStatus.PENDING) {
    return { success: false, error: "Ce tenant n'est pas en attente" };
  }

  const owner = await input.prisma.user.findFirst({
    where: { tenantId: tenant.id, role: "TENANT_ADMIN" },
  });
  if (!owner) return { success: false, error: "Propriétaire introuvable" };

  const { token, expiresAt: tokenExpires } = generateActivationToken();
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  await input.prisma.$transaction([
    input.prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        status: TenantStatus.ACTIVE,
        validatedAt: new Date(),
        validatedById: input.platformOwnerId,
        trialEndsAt,
      },
    }),
    input.prisma.user.update({
      where: { id: owner.id },
      data: {
        activationToken: token,
        activationTokenExpiresAt: tokenExpires,
      },
    }),
  ]);

  const appUrl = input.appUrl ?? process.env.APP_URL ?? "http://localhost:3000";
  const activationUrl = `${appUrl}/activate?token=${token}`;
  return { success: true, activationUrl };
}

export interface RejectTenantInput {
  tenantId: string;
  platformOwnerId: string;
  reason: string;
  prisma: PrismaClient;
}

export async function rejectTenant(input: RejectTenantInput): Promise<{ success: boolean; error?: string }> {
  if (!input.reason || input.reason.trim().length === 0) {
    return { success: false, error: "Raison du refus requise" };
  }
  const tenant = await input.prisma.tenant.findUnique({ where: { id: input.tenantId } });
  if (!tenant) return { success: false, error: "Tenant introuvable" };
  if (tenant.status !== TenantStatus.PENDING) {
    return { success: false, error: "Ce tenant n'est pas en attente" };
  }
  await input.prisma.tenant.update({
    where: { id: input.tenantId },
    data: {
      status: TenantStatus.REJECTED,
      rejectionReason: input.reason.trim(),
    },
  });
  return { success: true };
}

export interface SuspendTenantInput {
  tenantId: string;
  platformOwnerId: string;
  prisma: PrismaClient;
}

export async function suspendTenant(input: SuspendTenantInput): Promise<{ success: boolean; error?: string }> {
  const tenant = await input.prisma.tenant.findUnique({ where: { id: input.tenantId } });
  if (!tenant) return { success: false, error: "Tenant introuvable" };
  if (tenant.status !== TenantStatus.ACTIVE) {
    return { success: false, error: "Seul un tenant ACTIF peut être suspendu" };
  }
  await input.prisma.tenant.update({
    where: { id: input.tenantId },
    data: { status: TenantStatus.SUSPENDED },
  });
  return { success: true };
}
