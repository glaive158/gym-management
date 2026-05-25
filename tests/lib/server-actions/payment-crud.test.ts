import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, resetDb } from "../../helpers/db";
import { createPayment, listPayments, getMonthlyPaymentTotal } from "@/lib/server-actions/payment-crud";
import { createMember } from "@/lib/server-actions/member-crud";
import { createPlan } from "@/lib/server-actions/plan-crud";
import { assignSubscription } from "@/lib/server-actions/subscription-crud";
import { PaymentMethod, TenantStatus } from "@prisma/client";

async function seedFull() {
  const t = await testPrisma.tenant.create({
    data: { name: "TestTenant", slug: "tt", ownerEmail: "o@t.com", ownerPhone: "1", city: "Dakar", status: TenantStatus.ACTIVE },
  });
  const g = await testPrisma.gym.create({
    data: { tenantId: t.id, name: "Gym1", address: "Rue 1", city: "Dakar", phone: "1", latitude: 14.7, longitude: -17.4 },
  });
  const m = await createMember({
    tenantId: t.id, name: "Fatou", email: "f@t.com", phone: "+221770000001",
    avatar: "/uploads/f.jpg", prisma: testPrisma,
  });
  const p = await createPlan({
    tenantId: t.id, gymId: g.id, name: "Mensuel", durationDays: 30, price: 25000, prisma: testPrisma,
  });
  const s = await assignSubscription({
    tenantId: t.id, memberId: m.userId!, planId: p.planId!, prisma: testPrisma,
  });
  return { t, g, memberId: m.userId!, planId: p.planId!, subscriptionId: s.subscriptionId! };
}

afterAll(async () => { await testPrisma.$disconnect(); });

describe("createPayment", () => {
  beforeEach(async () => { await resetDb(); });

  it("records a CASH payment linked to a subscription", async () => {
    const { t, g, memberId, subscriptionId } = await seedFull();
    const r = await createPayment({
      tenantId: t.id, gymId: g.id, memberId, subscriptionId,
      amount: 25000, method: PaymentMethod.CASH, prisma: testPrisma,
    });
    expect(r.success).toBe(true);
    const payments = await testPrisma.payment.findMany();
    expect(payments).toHaveLength(1);
    expect(payments[0].amount).toBe(25000);
    expect(payments[0].method).toBe(PaymentMethod.CASH);
    expect(payments[0].memberId).toBe(memberId);
  });

  it("records a WAVE payment with reference", async () => {
    const { t, g, memberId, subscriptionId } = await seedFull();
    const r = await createPayment({
      tenantId: t.id, gymId: g.id, memberId, subscriptionId,
      amount: 25000, method: PaymentMethod.WAVE,
      reference: "WAVE-TXN-12345", prisma: testPrisma,
    });
    expect(r.success).toBe(true);
    const p = await testPrisma.payment.findFirstOrThrow();
    expect(p.method).toBe(PaymentMethod.WAVE);
    expect(p.reference).toBe("WAVE-TXN-12345");
  });

  it("rejects amount <= 0", async () => {
    const { t, g, memberId, subscriptionId } = await seedFull();
    const r = await createPayment({
      tenantId: t.id, gymId: g.id, memberId, subscriptionId,
      amount: 0, method: PaymentMethod.CASH, prisma: testPrisma,
    });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/montant/i);
  });

  it("rejects member not in tenant", async () => {
    const { t, g, subscriptionId } = await seedFull();
    const t2 = await testPrisma.tenant.create({
      data: { name: "T2", slug: "t2", ownerEmail: "x@y.com", ownerPhone: "2", city: "SL", status: TenantStatus.ACTIVE },
    });
    const m2 = await createMember({
      tenantId: t2.id, name: "X", email: "x@y.com", phone: "+221770000002",
      avatar: "/uploads/x.jpg", prisma: testPrisma,
    });
    const r = await createPayment({
      tenantId: t.id, gymId: g.id, memberId: m2.userId!, subscriptionId,
      amount: 1000, method: PaymentMethod.CASH, prisma: testPrisma,
    });
    expect(r.success).toBe(false);
  });

  it("rejects NaN amount", async () => {
    const { t, g, memberId, subscriptionId } = await seedFull();
    const r = await createPayment({
      tenantId: t.id, gymId: g.id, memberId, subscriptionId,
      amount: Number("abc"), method: PaymentMethod.CASH, prisma: testPrisma,
    });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/montant/i);
  });

  it("rejects subscription not belonging to member", async () => {
    const { t, g, memberId, planId } = await seedFull();
    const m2 = await createMember({
      tenantId: t.id, name: "Baye", email: "b@t.com", phone: "+221770000003",
      avatar: "/uploads/b.jpg", prisma: testPrisma,
    });
    const s2 = await assignSubscription({
      tenantId: t.id, memberId: m2.userId!, planId: planId!, prisma: testPrisma,
    });
    const r = await createPayment({
      tenantId: t.id, gymId: g.id, memberId,
      subscriptionId: s2.subscriptionId!,
      amount: 5000, method: PaymentMethod.CASH, prisma: testPrisma,
    });
    expect(r.success).toBe(false);
  });
});

describe("listPayments", () => {
  beforeEach(async () => { await resetDb(); });

  it("lists payments filtered by gymId, ordered by paidAt desc", async () => {
    const { t, g, memberId, subscriptionId } = await seedFull();
    await createPayment({
      tenantId: t.id, gymId: g.id, memberId, subscriptionId,
      amount: 10000, method: PaymentMethod.CASH,
      paidAt: new Date("2026-05-01"), prisma: testPrisma,
    });
    await createPayment({
      tenantId: t.id, gymId: g.id, memberId, subscriptionId,
      amount: 25000, method: PaymentMethod.WAVE,
      paidAt: new Date("2026-05-20"), prisma: testPrisma,
    });
    const list = await listPayments({ tenantId: t.id, gymId: g.id, prisma: testPrisma });
    expect(list).toHaveLength(2);
    expect(list[0].amount).toBe(25000);
    expect(list[0].memberName).toBe("Fatou");
  });

  it("returns empty list when no payments", async () => {
    const { t, g } = await seedFull();
    const list = await listPayments({ tenantId: t.id, gymId: g.id, prisma: testPrisma });
    expect(list).toHaveLength(0);
  });

  it("tenant isolation: does not return another tenant's payments", async () => {
    const { t, g, memberId, subscriptionId } = await seedFull();
    const t2 = await testPrisma.tenant.create({
      data: { name: "T2", slug: "t2", ownerEmail: "x@y.com", ownerPhone: "2", city: "SL", status: TenantStatus.ACTIVE },
    });
    await createPayment({
      tenantId: t.id, gymId: g.id, memberId, subscriptionId,
      amount: 25000, method: PaymentMethod.CASH, prisma: testPrisma,
    });
    const list = await listPayments({ tenantId: t2.id, prisma: testPrisma });
    expect(list).toHaveLength(0);
  });
});

describe("getMonthlyPaymentTotal", () => {
  beforeEach(async () => { await resetDb(); });

  it("sums payments for the given month only", async () => {
    const { t, g, memberId, subscriptionId } = await seedFull();
    await createPayment({
      tenantId: t.id, gymId: g.id, memberId, subscriptionId,
      amount: 25000, method: PaymentMethod.CASH,
      paidAt: new Date("2026-05-05"), prisma: testPrisma,
    });
    await createPayment({
      tenantId: t.id, gymId: g.id, memberId, subscriptionId,
      amount: 15000, method: PaymentMethod.WAVE,
      paidAt: new Date("2026-05-20"), prisma: testPrisma,
    });
    await createPayment({
      tenantId: t.id, gymId: g.id, memberId, subscriptionId,
      amount: 5000, method: PaymentMethod.CASH,
      paidAt: new Date("2026-04-15"), prisma: testPrisma,
    });
    const r = await getMonthlyPaymentTotal({
      tenantId: t.id, gymId: g.id, year: 2026, month: 5, prisma: testPrisma,
    });
    expect(r.total).toBe(40000);
    expect(r.count).toBe(2);
  });

  it("returns 0 total when no payments in month", async () => {
    const { t, g } = await seedFull();
    const r = await getMonthlyPaymentTotal({
      tenantId: t.id, gymId: g.id, year: 2026, month: 5, prisma: testPrisma,
    });
    expect(r.total).toBe(0);
    expect(r.count).toBe(0);
  });
});
