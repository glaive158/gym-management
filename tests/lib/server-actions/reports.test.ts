import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, resetDb } from "../../helpers/db";
import { getManagerReport, getTenantReport } from "@/lib/server-actions/reports";
import { Role, SubscriptionStatus, TenantStatus, UserStatus, PaymentMethod, CheckInStatus } from "@prisma/client";

async function seedGymWithData(tenantName: string, gymName: string) {
  const tenant = await testPrisma.tenant.create({
    data: { name: tenantName, slug: `${tenantName}${Date.now()}${Math.random()}`, ownerEmail: "o@x.com", ownerPhone: "1", city: "Dakar", status: TenantStatus.ACTIVE },
  });
  const gym = await testPrisma.gym.create({
    data: { tenantId: tenant.id, name: gymName, address: "a", city: "Dakar", phone: "1", latitude: 14.7, longitude: -17.4 },
  });
  const member = await testPrisma.user.create({
    data: { name: "M", email: `m${Date.now()}${Math.random()}@x.com`, passwordHash: "x", role: Role.MEMBER, status: UserStatus.ACTIVE, tenantId: tenant.id },
  });
  const plan = await testPrisma.plan.create({
    data: { tenantId: tenant.id, gymId: gym.id, name: "M", durationDays: 30, price: 10000, currency: "XOF" },
  });
  const sub = await testPrisma.subscription.create({
    data: { tenantId: tenant.id, memberId: member.id, planId: plan.id, startDate: new Date(), endDate: new Date(Date.now() + 30 * 86400000), status: SubscriptionStatus.ACTIVE },
  });
  await testPrisma.payment.create({
    data: { tenantId: tenant.id, gymId: gym.id, memberId: member.id, subscriptionId: sub.id, amount: 10000, method: PaymentMethod.CASH, paidAt: new Date() },
  });
  await testPrisma.checkIn.create({
    data: { tenantId: tenant.id, gymId: gym.id, memberId: member.id, subscriptionId: sub.id, status: CheckInStatus.VALID, source: "MANUAL" },
  });
  return { tenant, gym, member };
}

describe("getManagerReport", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("returns monthly totals scoped to one gym", async () => {
    const { tenant, gym } = await seedGymWithData("Tenant1", "Gym1");
    const now = new Date();
    const r = await getManagerReport({
      tenantId: tenant.id, gymId: gym.id, year: now.getFullYear(), month: now.getMonth() + 1, prisma: testPrisma,
    });
    expect(r.revenueXof).toBe(10000);
    expect(r.paymentsCount).toBe(1);
    expect(r.checkInsCount).toBe(1);
    expect(r.activeSubscriptions).toBe(1);
  });

  it("excludes other gyms", async () => {
    const a = await seedGymWithData("T1", "G1");
    await seedGymWithData("T1bis", "G2");
    const now = new Date();
    const r = await getManagerReport({
      tenantId: a.tenant.id, gymId: a.gym.id, year: now.getFullYear(), month: now.getMonth() + 1, prisma: testPrisma,
    });
    expect(r.revenueXof).toBe(10000);
  });
});

describe("getTenantReport", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("aggregates across all gyms of tenant", async () => {
    const a = await seedGymWithData("Tenant1", "G1");
    const gym2 = await testPrisma.gym.create({
      data: { tenantId: a.tenant.id, name: "G2", address: "a", city: "Dakar", phone: "1", latitude: 14.7, longitude: -17.4 },
    });
    const member2 = await testPrisma.user.create({
      data: { name: "M2", email: `m2${Date.now()}@x.com`, passwordHash: "x", role: Role.MEMBER, status: UserStatus.ACTIVE, tenantId: a.tenant.id },
    });
    const plan2 = await testPrisma.plan.create({
      data: { tenantId: a.tenant.id, gymId: gym2.id, name: "M", durationDays: 30, price: 5000, currency: "XOF" },
    });
    const sub2 = await testPrisma.subscription.create({
      data: { tenantId: a.tenant.id, memberId: member2.id, planId: plan2.id, startDate: new Date(), endDate: new Date(Date.now() + 30 * 86400000), status: SubscriptionStatus.ACTIVE },
    });
    await testPrisma.payment.create({
      data: { tenantId: a.tenant.id, gymId: gym2.id, memberId: member2.id, subscriptionId: sub2.id, amount: 5000, method: PaymentMethod.WAVE, paidAt: new Date() },
    });

    const now = new Date();
    const r = await getTenantReport({
      tenantId: a.tenant.id, year: now.getFullYear(), month: now.getMonth() + 1, prisma: testPrisma,
    });
    expect(r.revenueXof).toBe(15000);
    expect(r.byGym).toHaveLength(2);
    const g1 = r.byGym.find((g) => g.gymName === "G1");
    const g2 = r.byGym.find((g) => g.gymName === "G2");
    expect(g1?.revenueXof).toBe(10000);
    expect(g2?.revenueXof).toBe(5000);
  });

  it("excludes other tenants", async () => {
    const a = await seedGymWithData("T1", "G1");
    await seedGymWithData("T2", "GO");
    const now = new Date();
    const r = await getTenantReport({
      tenantId: a.tenant.id, year: now.getFullYear(), month: now.getMonth() + 1, prisma: testPrisma,
    });
    expect(r.revenueXof).toBe(10000);
  });
});
