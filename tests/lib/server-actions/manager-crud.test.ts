import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, resetDb } from "../../helpers/db";
import { createManager, listManagers, deactivateManager } from "@/lib/server-actions/manager-crud";
import { Role, TenantStatus, UserStatus } from "@prisma/client";

afterAll(async () => { await testPrisma.$disconnect(); });

async function seedTenantAndGym() {
  const t = await testPrisma.tenant.create({
    data: { name: "F", slug: "f", ownerEmail: "a@x.com", ownerPhone: "1", city: "Dakar", status: TenantStatus.ACTIVE },
  });
  const g = await testPrisma.gym.create({
    data: { tenantId: t.id, name: "G1", address: "x", city: "Dakar", phone: "1", latitude: 14.7, longitude: -17.4 },
  });
  return { t, g };
}

describe("createManager", () => {
  beforeEach(async () => { await resetDb(); });

  it("creates a PENDING manager with activation token", async () => {
    const { t, g } = await seedTenantAndGym();
    const r = await createManager({
      tenantId: t.id, gymId: g.id,
      name: "Manager 1", email: "m1@x.com", phone: "+221770000000",
      prisma: testPrisma,
    });
    expect(r.success).toBe(true);
    const user = await testPrisma.user.findUniqueOrThrow({ where: { email: "m1@x.com" } });
    expect(user.role).toBe(Role.MANAGER);
    expect(user.status).toBe(UserStatus.PENDING);
    expect(user.tenantId).toBe(t.id);
    expect(user.gymId).toBe(g.id);
    expect(user.passwordHash).toBeNull();
    expect(user.activationToken).not.toBeNull();
    expect(r.activationUrl).toMatch(/\/activate\?token=/);
  });

  it("rejects duplicate email", async () => {
    const { t, g } = await seedTenantAndGym();
    await createManager({ tenantId: t.id, gymId: g.id, name: "A", email: "x@x.com", phone: "+221770000000", prisma: testPrisma });
    const r = await createManager({ tenantId: t.id, gymId: g.id, name: "B", email: "x@x.com", phone: "+221770000000", prisma: testPrisma });
    expect(r.success).toBe(false);
  });

  it("rejects gym from another tenant", async () => {
    const { g } = await seedTenantAndGym();
    const t2 = await testPrisma.tenant.create({
      data: { name: "T2", slug: "t2", ownerEmail: "b@x.com", ownerPhone: "1", city: "x", status: TenantStatus.ACTIVE },
    });
    const r = await createManager({
      tenantId: t2.id, gymId: g.id,
      name: "M", email: "m@x.com", phone: "+221770000000", prisma: testPrisma,
    });
    expect(r.success).toBe(false);
  });
});

describe("listManagers", () => {
  beforeEach(async () => { await resetDb(); });

  it("returns managers of a tenant only", async () => {
    const { t, g } = await seedTenantAndGym();
    await createManager({ tenantId: t.id, gymId: g.id, name: "A", email: "ma@x.com", phone: "+221770000001", prisma: testPrisma });
    await createManager({ tenantId: t.id, gymId: g.id, name: "B", email: "mb@x.com", phone: "+221770000002", prisma: testPrisma });
    const list = await listManagers({ tenantId: t.id, prisma: testPrisma });
    expect(list).toHaveLength(2);
    expect(list.every(m => m.role === Role.MANAGER)).toBe(true);
  });
});

describe("deactivateManager", () => {
  beforeEach(async () => { await resetDb(); });

  it("flips manager status to SUSPENDED", async () => {
    const { t, g } = await seedTenantAndGym();
    const c = await createManager({ tenantId: t.id, gymId: g.id, name: "A", email: "a@x.com", phone: "+221770000000", prisma: testPrisma });
    const r = await deactivateManager({ tenantId: t.id, managerId: c.userId!, prisma: testPrisma });
    expect(r.success).toBe(true);
    const u = await testPrisma.user.findUniqueOrThrow({ where: { id: c.userId! } });
    expect(u.status).toBe(UserStatus.SUSPENDED);
  });
});
