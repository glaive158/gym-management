import { z } from "zod";
import { PrismaClient, Role, TenantStatus, UserStatus } from "@prisma/client";
import { slugify, uniqueSlug } from "@/lib/slug";

const SignupSchema = z.object({
  organizationName: z.string().min(1, "Nom de l'organisation requis"),
  ownerName: z.string().min(1, "Nom du propriétaire requis"),
  ownerEmail: z.string().email("Email invalide"),
  ownerPhone: z.string().min(5, "Téléphone requis"),
  city: z.string().min(1, "Ville requise"),
});

export interface CreateSignupResult {
  success: boolean;
  tenantId?: string;
  error?: string;
}

export async function createSignupRequest(input: {
  organizationName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  city: string;
  prisma: PrismaClient;
}): Promise<CreateSignupResult> {
  const parsed = SignupSchema.safeParse({
    organizationName: input.organizationName,
    ownerName: input.ownerName,
    ownerEmail: input.ownerEmail,
    ownerPhone: input.ownerPhone,
    city: input.city,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const email = parsed.data.ownerEmail.toLowerCase();
  const existing = await input.prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { success: false, error: "Cet email est déjà utilisé" };
  }

  const baseSlug = slugify(parsed.data.organizationName) || "tenant";
  const slug = await uniqueSlug(baseSlug, async (s) => {
    const found = await input.prisma.tenant.findUnique({ where: { slug: s } });
    return !!found;
  });

  const tenant = await input.prisma.tenant.create({
    data: {
      name: parsed.data.organizationName,
      slug,
      ownerEmail: email,
      ownerPhone: parsed.data.ownerPhone,
      city: parsed.data.city,
      status: TenantStatus.PENDING,
    },
  });

  await input.prisma.user.create({
    data: {
      name: parsed.data.ownerName,
      email,
      phone: parsed.data.ownerPhone,
      passwordHash: null,
      role: Role.TENANT_ADMIN,
      status: UserStatus.PENDING,
      tenantId: tenant.id,
    },
  });

  return { success: true, tenantId: tenant.id };
}
