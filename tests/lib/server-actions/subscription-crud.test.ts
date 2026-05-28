import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, resetDb } from "../../helpers/db";
import { assignSubscription, cancelSubscription } from "@/lib/server-actions/subscription-crud";
import { createMember } from "@/lib/server-actions/member-crud";
import { createPlan } from "@/lib/server-actions/plan-crud";
import { SubscriptionStatus, TenantStatus } from "@prisma/client";

async function seedFull() {
  const t = await testPrisma.tenant.create({
    data: { name: "F", slug: "f", ownerEmail: "a@x.com", ownerPhone: "1", city: "x", status: TenantStatus.ACTIVE },
  });
  const g = await testPrisma.gym.create({
    data: { tenantId: t.id, name: "G1", address: "x", city: "x", phone: "1", latitude: 14.7, longitude: -17.4 },
  });
  const m = await createMember({
    tenantId: t.id, name: "Aliou", email: "a@x.com", phone: "+221770000001",
    avatar: "/uploads/a.jpg", password: "secret123", prisma: testPrisma,
  });
  const p = await createPlan({
    tenantId: t.id, gymId: g.id, name: "Mensuel", durationDays: 30, price: 25000, prisma: testPrisma,
  });
  return { t, g, memberId: m.userId!, planId: p.planId! };
}

afterAll(async () => { await testPrisma.$disconnect(); });

describe("assignSubscription", () => {
  beforeEach(async () => { await resetDb(); });

  it("creates ACTIVE subscription with endDate = startDate + durationDays", async () => {
    const { t, memberId, planId } = await seedFull();
    const start = new Date("2026-05-24T00:00:00Z");
    const r = await assignSubscription({
      tenantId: t.id, memberId, planId, startDate: start, prisma: testPrisma,
    });
    expect(r.success).toBe(true);
    const subs = await testPrisma.subscription.findMany();
    expect(subs).toHaveLength(1);
    expect(subs[0].status).toBe(SubscriptionStatus.ACTIVE);
    expect(subs[0].startDate.toISOString()).toBe(start.toISOString());
    const expectedEnd = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
    expect(subs[0].endDate.toISOString()).toBe(expectedEnd.toISOString());
  });

  it("rejects when member not in tenant", async () => {
    const { t, planId } = await seedFull();
    const t2 = await testPrisma.tenant.create({
      data: { name: "T2", slug: "t2", ownerEmail: "b@x.com", ownerPhone: "1", city: "x", status: TenantStatus.ACTIVE },
    });
    const otherMember = await createMember({
      tenantId: t2.id, name: "X", email: "x@x.com", phone: "+221770000002",
      avatar: "/uploads/x.jpg", password: "secret123", prisma: testPrisma,
    });
    const r = await assignSubscription({
      tenantId: t.id, memberId: otherMember.userId!, planId,
      startDate: new Date(), prisma: testPrisma,
    });
    expect(r.success).toBe(false);
  });

  it("defaults startDate to now when omitted", async () => {
    const { t, memberId, planId } = await seedFull();
    const before = Date.now();
    const r = await assignSubscription({
      tenantId: t.id, memberId, planId, prisma: testPrisma,
    });
    expect(r.success).toBe(true);
    const s = await testPrisma.subscription.findFirstOrThrow();
    expect(s.startDate.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(s.startDate.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });
});

describe("cancelSubscription", () => {
  beforeEach(async () => { await resetDb(); });

  it("flips status to CANCELLED", async () => {
    const { t, memberId, planId } = await seedFull();
    const c = await assignSubscription({ tenantId: t.id, memberId, planId, prisma: testPrisma });
    const r = await cancelSubscription({ tenantId: t.id, subscriptionId: c.subscriptionId!, prisma: testPrisma });
    expect(r.success).toBe(true);
    const s = await testPrisma.subscription.findUniqueOrThrow({ where: { id: c.subscriptionId! } });
    expect(s.status).toBe(SubscriptionStatus.CANCELLED);
  });
});
