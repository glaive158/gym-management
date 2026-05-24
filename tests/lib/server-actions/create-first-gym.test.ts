import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, resetDb } from "../../helpers/db";
import { createFirstGym } from "@/lib/server-actions/create-first-gym";
import { Role, TenantStatus, UserStatus } from "@prisma/client";

async function seedActiveTenant() {
  const tenant = await testPrisma.tenant.create({
    data: {
      name: "FitClub", slug: "fitclub", ownerEmail: "a@x.com", ownerPhone: "1",
      city: "Dakar", status: TenantStatus.ACTIVE,
    },
  });
  const admin = await testPrisma.user.create({
    data: {
      name: "Aliou", email: "a@x.com", passwordHash: "hash",
      role: Role.TENANT_ADMIN, status: UserStatus.ACTIVE, tenantId: tenant.id,
    },
  });
  return { tenant, admin };
}

describe("createFirstGym", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("creates a gym scoped to the tenant", async () => {
    const { tenant, admin } = await seedActiveTenant();
    const result = await createFirstGym({
      tenantId: tenant.id,
      userId: admin.id,
      name: "FitClub Plateau",
      address: "123 rue X",
      city: "Dakar",
      phone: "+221770000000",
      latitude: 14.7,
      longitude: -17.4,
      prisma: testPrisma,
    });
    expect(result.success).toBe(true);
    const gyms = await testPrisma.gym.findMany();
    expect(gyms).toHaveLength(1);
    expect(gyms[0].tenantId).toBe(tenant.id);
    expect(gyms[0].name).toBe("FitClub Plateau");
    expect(gyms[0].qrToken).toBeTypeOf("string");
    expect(gyms[0].qrToken.length).toBeGreaterThan(10);
  });

  it("rejects when tenant is not ACTIVE", async () => {
    const { tenant, admin } = await seedActiveTenant();
    await testPrisma.tenant.update({ where: { id: tenant.id }, data: { status: TenantStatus.SUSPENDED } });
    const result = await createFirstGym({
      tenantId: tenant.id, userId: admin.id,
      name: "X", address: "x", city: "x", phone: "1",
      latitude: 0, longitude: 0, prisma: testPrisma,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", async () => {
    const { tenant, admin } = await seedActiveTenant();
    const result = await createFirstGym({
      tenantId: tenant.id, userId: admin.id,
      name: "", address: "x", city: "x", phone: "1",
      latitude: 0, longitude: 0, prisma: testPrisma,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid coordinates", async () => {
    const { tenant, admin } = await seedActiveTenant();
    const result = await createFirstGym({
      tenantId: tenant.id, userId: admin.id,
      name: "X", address: "x", city: "x", phone: "1",
      latitude: 999, longitude: 0, prisma: testPrisma,
    });
    expect(result.success).toBe(false);
  });
});
