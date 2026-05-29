import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { testPrisma, resetDb } from "../../helpers/db";
import { initiatePayment, confirmPayment } from "@/lib/server-actions/paydunya-payments";
import { createMember } from "@/lib/server-actions/member-crud";
import { createPlan } from "@/lib/server-actions/plan-crud";
import { PaymentIntentStatus, SubscriptionStatus, TenantStatus } from "@prisma/client";
import type { PaydunyaConfig } from "@/lib/paydunya";

const config: PaydunyaConfig = { mode: "test", masterKey: "MK", privateKey: "PK", token: "TK", storeName: "Gym" };

afterEach(() => { vi.restoreAllMocks(); });
afterAll(async () => { await testPrisma.$disconnect(); });

async function seed() {
  const t = await testPrisma.tenant.create({
    data: { name: "F", slug: `f${Date.now()}`, ownerEmail: "a@x.com", ownerPhone: "1", city: "Dakar", status: TenantStatus.ACTIVE },
  });
  const g = await testPrisma.gym.create({
    data: { tenantId: t.id, name: "G1", address: "x", city: "Dakar", phone: "1", latitude: 14.7, longitude: -17.4 },
  });
  const m = await createMember({
    tenantId: t.id, name: "M", email: "m@x.com", phone: "+221770000000",
    avatar: "/uploads/a.jpg", password: "secret123", prisma: testPrisma,
  });
  const p = await createPlan({ tenantId: t.id, gymId: g.id, name: "Mensuel", durationDays: 30, price: 25000, prisma: testPrisma });
  return { t, g, memberId: m.userId!, planId: p.planId! };
}

describe("initiatePayment", () => {
  beforeEach(async () => { await resetDb(); });

  it("creates a PENDING intent and stores the PayDunya token", async () => {
    const { t, memberId, planId } = await seed();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ response_code: "00", token: "tok_1", checkout_url: "https://pay/tok_1" }),
    }));

    const r = await initiatePayment({
      tenantId: t.id, memberId, planId,
      appUrl: "https://gym.kaytech.sn", config, prisma: testPrisma,
    });

    expect(r.success).toBe(true);
    expect(r.redirectUrl).toBe("https://pay/tok_1");
    const intent = await testPrisma.paymentIntent.findFirstOrThrow({ where: { id: r.intentId! } });
    expect(intent.status).toBe(PaymentIntentStatus.PENDING);
    expect(intent.token).toBe("tok_1");
    expect(intent.amount).toBe(25000);
  });

  it("marks intent FAILED when PayDunya rejects", async () => {
    const { t, memberId, planId } = await seed();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 200, json: async () => ({ response_code: "1001", response_text: "Bad keys" }),
    }));
    const r = await initiatePayment({
      tenantId: t.id, memberId, planId,
      appUrl: "https://x", config, prisma: testPrisma,
    });
    expect(r.success).toBe(false);
    const intent = await testPrisma.paymentIntent.findFirstOrThrow({ where: { memberId } });
    expect(intent.status).toBe(PaymentIntentStatus.FAILED);
  });
});

describe("confirmPayment", () => {
  beforeEach(async () => { await resetDb(); });

  async function seedPendingIntent() {
    const s = await seed();
    const intent = await testPrisma.paymentIntent.create({
      data: { tenantId: s.t.id, gymId: s.g.id, memberId: s.memberId, planId: s.planId, amount: 25000, token: "tok_x", status: PaymentIntentStatus.PENDING },
    });
    return { ...s, intentId: intent.id };
  }

  it("activates subscription + records payment when completed", async () => {
    const { memberId } = await seedPendingIntent();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 200, json: async () => ({ response_code: "00", status: "completed" }),
    }));

    const r = await confirmPayment({ token: "tok_x", config, prisma: testPrisma });
    expect(r.success).toBe(true);

    const subs = await testPrisma.subscription.findMany({ where: { memberId } });
    expect(subs).toHaveLength(1);
    expect(subs[0].status).toBe(SubscriptionStatus.ACTIVE);
    const payments = await testPrisma.payment.findMany({ where: { memberId } });
    expect(payments).toHaveLength(1);
    expect(payments[0].method).toBe("PAYDUNYA");
    const intent = await testPrisma.paymentIntent.findFirstOrThrow({ where: { token: "tok_x" } });
    expect(intent.status).toBe(PaymentIntentStatus.COMPLETED);
  });

  it("is idempotent (no duplicate payment on second call)", async () => {
    const { memberId } = await seedPendingIntent();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 200, json: async () => ({ response_code: "00", status: "completed" }),
    }));
    await confirmPayment({ token: "tok_x", config, prisma: testPrisma });
    await confirmPayment({ token: "tok_x", config, prisma: testPrisma });
    const payments = await testPrisma.payment.findMany({ where: { memberId } });
    expect(payments).toHaveLength(1);
  });

  it("does nothing when status still pending", async () => {
    const { memberId } = await seedPendingIntent();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 200, json: async () => ({ response_code: "00", status: "pending" }),
    }));
    const r = await confirmPayment({ token: "tok_x", config, prisma: testPrisma });
    expect(r.success).toBe(true);
    const payments = await testPrisma.payment.findMany({ where: { memberId } });
    expect(payments).toHaveLength(0);
  });

  it("returns error for unknown token", async () => {
    const r = await confirmPayment({ token: "nope", config, prisma: testPrisma });
    expect(r.success).toBe(false);
  });
});
