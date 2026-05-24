import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, resetDb } from "../../helpers/db";
import { createSignupRequest } from "@/lib/server-actions/tenant-signup";
import {
  validateTenant,
  rejectTenant,
  suspendTenant,
} from "@/lib/server-actions/tenant-validation";
import { Role, TenantStatus, UserStatus } from "@prisma/client";

async function seedSignup() {
  await createSignupRequest({
    organizationName: "FitClub",
    ownerName: "Aliou",
    ownerEmail: "aliou@fitclub.sn",
    ownerPhone: "+221771234567",
    city: "Dakar",
    prisma: testPrisma,
  });
  const tenant = await testPrisma.tenant.findFirstOrThrow();
  const owner = await testPrisma.user.findFirstOrThrow({ where: { role: Role.TENANT_ADMIN } });
  return { tenant, owner };
}

async function seedPlatformOwner() {
  return testPrisma.user.create({
    data: {
      name: "PO",
      email: "po@platform.local",
      passwordHash: "hash",
      role: Role.PLATFORM_OWNER,
      status: UserStatus.ACTIVE,
    },
  });
}

describe("validateTenant", () => {
  beforeEach(async () => {
    await resetDb();
  });
  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("flips tenant to ACTIVE, sets validatedAt + validatedById", async () => {
    const po = await seedPlatformOwner();
    const { tenant } = await seedSignup();
    const result = await validateTenant({
      tenantId: tenant.id,
      platformOwnerId: po.id,
      prisma: testPrisma,
    });
    expect(result.success).toBe(true);
    const updated = await testPrisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
    expect(updated.status).toBe(TenantStatus.ACTIVE);
    expect(updated.validatedAt).not.toBeNull();
    expect(updated.validatedById).toBe(po.id);
    expect(updated.trialEndsAt).not.toBeNull();
  });

  it("generates activation token on the owner user", async () => {
    const po = await seedPlatformOwner();
    const { tenant, owner } = await seedSignup();
    await validateTenant({ tenantId: tenant.id, platformOwnerId: po.id, prisma: testPrisma });
    const updatedOwner = await testPrisma.user.findUniqueOrThrow({ where: { id: owner.id } });
    expect(updatedOwner.activationToken).not.toBeNull();
    expect(updatedOwner.activationTokenExpiresAt).not.toBeNull();
    expect(updatedOwner.status).toBe(UserStatus.PENDING);
  });

  it("returns activation URL in result", async () => {
    const po = await seedPlatformOwner();
    const { tenant } = await seedSignup();
    const result = await validateTenant({
      tenantId: tenant.id,
      platformOwnerId: po.id,
      prisma: testPrisma,
      appUrl: "https://app.example.com",
    });
    expect(result.activationUrl).toMatch(/^https:\/\/app\.example\.com\/activate\?token=/);
  });

  it("refuses to validate a non-PENDING tenant", async () => {
    const po = await seedPlatformOwner();
    const { tenant } = await seedSignup();
    await testPrisma.tenant.update({ where: { id: tenant.id }, data: { status: TenantStatus.ACTIVE } });
    const result = await validateTenant({
      tenantId: tenant.id,
      platformOwnerId: po.id,
      prisma: testPrisma,
    });
    expect(result.success).toBe(false);
  });
});

describe("rejectTenant", () => {
  beforeEach(async () => {
    await resetDb();
  });
  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("flips tenant to REJECTED with reason", async () => {
    const po = await seedPlatformOwner();
    const { tenant } = await seedSignup();
    const result = await rejectTenant({
      tenantId: tenant.id,
      platformOwnerId: po.id,
      reason: "Documents manquants",
      prisma: testPrisma,
    });
    expect(result.success).toBe(true);
    const updated = await testPrisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
    expect(updated.status).toBe(TenantStatus.REJECTED);
    expect(updated.rejectionReason).toBe("Documents manquants");
  });

  it("requires a non-empty reason", async () => {
    const po = await seedPlatformOwner();
    const { tenant } = await seedSignup();
    const result = await rejectTenant({
      tenantId: tenant.id,
      platformOwnerId: po.id,
      reason: "",
      prisma: testPrisma,
    });
    expect(result.success).toBe(false);
  });
});

describe("suspendTenant", () => {
  beforeEach(async () => {
    await resetDb();
  });
  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("flips ACTIVE tenant to SUSPENDED", async () => {
    const po = await seedPlatformOwner();
    const { tenant } = await seedSignup();
    await testPrisma.tenant.update({ where: { id: tenant.id }, data: { status: TenantStatus.ACTIVE } });
    const result = await suspendTenant({
      tenantId: tenant.id,
      platformOwnerId: po.id,
      prisma: testPrisma,
    });
    expect(result.success).toBe(true);
    const updated = await testPrisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
    expect(updated.status).toBe(TenantStatus.SUSPENDED);
  });
});
