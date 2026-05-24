import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, resetDb } from "../../helpers/db";
import { createPlan, listPlans, deactivatePlan } from "@/lib/server-actions/plan-crud";
import { TenantStatus } from "@prisma/client";

async function seed() {
  const t = await testPrisma.tenant.create({
    data: { name: "F", slug: "f", ownerEmail: "a@x.com", ownerPhone: "1", city: "Dakar", status: TenantStatus.ACTIVE },
  });
  const g = await testPrisma.gym.create({
    data: { tenantId: t.id, name: "G1", address: "x", city: "x", phone: "1", latitude: 14.7, longitude: -17.4 },
  });
  return { t, g };
}

afterAll(async () => { await testPrisma.$disconnect(); });

describe("createPlan", () => {
  beforeEach(async () => { await resetDb(); });

  it("creates a plan scoped to tenant + gym", async () => {
    const { t, g } = await seed();
    const r = await createPlan({
      tenantId: t.id, gymId: g.id,
      name: "Mensuel", durationDays: 30, price: 25000,
      prisma: testPrisma,
    });
    expect(r.success).toBe(true);
    const plans = await testPrisma.plan.findMany();
    expect(plans).toHaveLength(1);
    expect(plans[0].tenantId).toBe(t.id);
    expect(plans[0].gymId).toBe(g.id);
    expect(plans[0].price).toBe(25000);
    expect(plans[0].currency).toBe("XOF");
  });

  it("rejects zero or negative price", async () => {
    const { t, g } = await seed();
    const r = await createPlan({
      tenantId: t.id, gymId: g.id,
      name: "X", durationDays: 30, price: 0,
      prisma: testPrisma,
    });
    expect(r.success).toBe(false);
  });

  it("rejects gym from another tenant", async () => {
    const { g } = await seed();
    const t2 = await testPrisma.tenant.create({
      data: { name: "T2", slug: "t2", ownerEmail: "b@x.com", ownerPhone: "1", city: "x", status: TenantStatus.ACTIVE },
    });
    const r = await createPlan({
      tenantId: t2.id, gymId: g.id,
      name: "X", durationDays: 30, price: 1000,
      prisma: testPrisma,
    });
    expect(r.success).toBe(false);
  });
});

describe("listPlans", () => {
  beforeEach(async () => { await resetDb(); });

  it("returns active plans of a gym ordered by durationDays", async () => {
    const { t, g } = await seed();
    await createPlan({ tenantId: t.id, gymId: g.id, name: "Annuel", durationDays: 365, price: 200000, prisma: testPrisma });
    await createPlan({ tenantId: t.id, gymId: g.id, name: "Mensuel", durationDays: 30, price: 25000, prisma: testPrisma });
    const list = await listPlans({ tenantId: t.id, gymId: g.id, prisma: testPrisma });
    expect(list.map(p => p.durationDays)).toEqual([30, 365]);
  });
});

describe("deactivatePlan", () => {
  beforeEach(async () => { await resetDb(); });

  it("sets isActive=false (soft delete)", async () => {
    const { t, g } = await seed();
    const c = await createPlan({ tenantId: t.id, gymId: g.id, name: "Mensuel", durationDays: 30, price: 25000, prisma: testPrisma });
    const r = await deactivatePlan({ tenantId: t.id, planId: c.planId!, prisma: testPrisma });
    expect(r.success).toBe(true);
    const p = await testPrisma.plan.findUniqueOrThrow({ where: { id: c.planId! } });
    expect(p.isActive).toBe(false);
  });
});
