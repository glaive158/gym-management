import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, resetDb } from "../../helpers/db";
import {
  generateMonthlyInvoices,
  checkOverdueInvoices,
  markInvoicePaid,
} from "@/lib/server-actions/billing";
import { Role, TenantStatus, BillingStatus, InvoiceStatus, TenantPaymentMethod, UserStatus } from "@prisma/client";

async function seedTenant(opts: { nbGyms?: number; isBeta?: boolean; trialEndsAt?: Date | null; status?: TenantStatus } = {}) {
  const tenant = await testPrisma.tenant.create({
    data: {
      name: "T", slug: `t${Date.now()}${Math.random()}`, ownerEmail: "o@x.com", ownerPhone: "1", city: "Dakar",
      status: opts.status ?? TenantStatus.ACTIVE,
      isBeta: opts.isBeta ?? false,
      trialEndsAt: opts.trialEndsAt === undefined ? new Date(Date.now() - 86400000) : opts.trialEndsAt,
    },
  });
  for (let i = 0; i < (opts.nbGyms ?? 1); i++) {
    await testPrisma.gym.create({
      data: { tenantId: tenant.id, name: `G${i}`, address: "a", city: "Dakar", phone: "1", latitude: 14.7, longitude: -17.4 },
    });
  }
  return tenant;
}

async function seedPO() {
  return testPrisma.user.create({
    data: { name: "PO", email: `po${Date.now()}@x.com`, passwordHash: "x", role: Role.PLATFORM_OWNER, status: UserStatus.ACTIVE },
  });
}

describe("generateMonthlyInvoices", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("creates invoice for ACTIVE tenant with N gyms × price", async () => {
    const t = await seedTenant({ nbGyms: 3 });
    const r = await generateMonthlyInvoices({ periodStart: new Date(2026, 5, 1), prisma: testPrisma });
    expect(r.created).toBe(1);
    const inv = await testPrisma.tenantInvoice.findFirstOrThrow();
    expect(inv.tenantId).toBe(t.id);
    expect(inv.nbGyms).toBe(3);
    expect(inv.unitPriceXof).toBe(25000);
    expect(inv.totalXof).toBe(75000);
    expect(inv.status).toBe(InvoiceStatus.PENDING);
  });

  it("skips tenants still in trial", async () => {
    await seedTenant({ trialEndsAt: new Date(Date.now() + 7 * 86400000) });
    const r = await generateMonthlyInvoices({ periodStart: new Date(2026, 5, 1), prisma: testPrisma });
    expect(r.created).toBe(0);
  });

  it("skips beta tenants", async () => {
    await seedTenant({ isBeta: true });
    const r = await generateMonthlyInvoices({ periodStart: new Date(2026, 5, 1), prisma: testPrisma });
    expect(r.created).toBe(0);
  });

  it("skips SUSPENDED/REJECTED tenants", async () => {
    await seedTenant({ status: TenantStatus.SUSPENDED });
    await seedTenant({ status: TenantStatus.REJECTED });
    const r = await generateMonthlyInvoices({ periodStart: new Date(2026, 5, 1), prisma: testPrisma });
    expect(r.created).toBe(0);
  });

  it("idempotent: rerun same period = no duplicate", async () => {
    await seedTenant({ nbGyms: 2 });
    await generateMonthlyInvoices({ periodStart: new Date(2026, 5, 1), prisma: testPrisma });
    const r = await generateMonthlyInvoices({ periodStart: new Date(2026, 5, 1), prisma: testPrisma });
    expect(r.created).toBe(0);
    expect(await testPrisma.tenantInvoice.count()).toBe(1);
  });

  it("uses tenant.monthlyPricePerGym override", async () => {
    const t = await seedTenant({ nbGyms: 1 });
    await testPrisma.tenant.update({ where: { id: t.id }, data: { monthlyPricePerGym: 15000 } });
    await generateMonthlyInvoices({ periodStart: new Date(2026, 5, 1), prisma: testPrisma });
    const inv = await testPrisma.tenantInvoice.findFirstOrThrow();
    expect(inv.unitPriceXof).toBe(15000);
    expect(inv.totalXof).toBe(15000);
  });
});

describe("checkOverdueInvoices", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("flips PENDING past dueDate → OVERDUE", async () => {
    const t = await seedTenant({ nbGyms: 1 });
    await testPrisma.tenantInvoice.create({
      data: {
        tenantId: t.id, periodStart: new Date(2026, 4, 1), periodEnd: new Date(2026, 4, 30),
        nbGyms: 1, unitPriceXof: 25000, totalXof: 25000,
        status: InvoiceStatus.PENDING,
        dueDate: new Date(Date.now() - 86400000),
      },
    });
    const r = await checkOverdueInvoices({ prisma: testPrisma });
    expect(r.markedOverdue).toBe(1);
    const inv = await testPrisma.tenantInvoice.findFirstOrThrow();
    expect(inv.status).toBe(InvoiceStatus.OVERDUE);
  });

  it("suspends tenant after 7d grace from dueDate", async () => {
    const t = await seedTenant({ nbGyms: 1 });
    await testPrisma.tenantInvoice.create({
      data: {
        tenantId: t.id, periodStart: new Date(2026, 4, 1), periodEnd: new Date(2026, 4, 30),
        nbGyms: 1, unitPriceXof: 25000, totalXof: 25000,
        status: InvoiceStatus.OVERDUE,
        dueDate: new Date(Date.now() - 8 * 86400000),
      },
    });
    const r = await checkOverdueInvoices({ prisma: testPrisma });
    expect(r.suspended).toBe(1);
    const tt = await testPrisma.tenant.findUniqueOrThrow({ where: { id: t.id } });
    expect(tt.status).toBe(TenantStatus.SUSPENDED);
    expect(tt.billingStatus).toBe(BillingStatus.SUSPENDED);
  });

  it("does NOT suspend within 7d grace", async () => {
    const t = await seedTenant({ nbGyms: 1 });
    await testPrisma.tenantInvoice.create({
      data: {
        tenantId: t.id, periodStart: new Date(2026, 4, 1), periodEnd: new Date(2026, 4, 30),
        nbGyms: 1, unitPriceXof: 25000, totalXof: 25000,
        status: InvoiceStatus.OVERDUE,
        dueDate: new Date(Date.now() - 3 * 86400000),
      },
    });
    const r = await checkOverdueInvoices({ prisma: testPrisma });
    expect(r.suspended).toBe(0);
    const tt = await testPrisma.tenant.findUniqueOrThrow({ where: { id: t.id } });
    expect(tt.status).toBe(TenantStatus.ACTIVE);
  });
});

describe("markInvoicePaid", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("flips invoice PAID, creates TenantPayment, reactivates if SUSPENDED", async () => {
    const t = await seedTenant({ nbGyms: 1, status: TenantStatus.SUSPENDED });
    await testPrisma.tenant.update({ where: { id: t.id }, data: { billingStatus: BillingStatus.SUSPENDED } });
    const inv = await testPrisma.tenantInvoice.create({
      data: {
        tenantId: t.id, periodStart: new Date(2026, 4, 1), periodEnd: new Date(2026, 4, 30),
        nbGyms: 1, unitPriceXof: 25000, totalXof: 25000,
        status: InvoiceStatus.OVERDUE,
        dueDate: new Date(Date.now() - 10 * 86400000),
      },
    });
    const po = await seedPO();
    const r = await markInvoicePaid({
      invoiceId: inv.id,
      method: TenantPaymentMethod.MANUAL_TRANSFER,
      externalRef: "REF123",
      recordedById: po.id,
      prisma: testPrisma,
    });
    expect(r.success).toBe(true);
    const updated = await testPrisma.tenantInvoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(updated.status).toBe(InvoiceStatus.PAID);
    expect(updated.paidAt).not.toBeNull();
    const payments = await testPrisma.tenantPayment.findMany();
    expect(payments).toHaveLength(1);
    expect(payments[0].amountXof).toBe(25000);
    const tt = await testPrisma.tenant.findUniqueOrThrow({ where: { id: t.id } });
    expect(tt.status).toBe(TenantStatus.ACTIVE);
    expect(tt.billingStatus).toBe(BillingStatus.ACTIVE);
  });

  it("rejects already PAID invoice", async () => {
    const t = await seedTenant({ nbGyms: 1 });
    const inv = await testPrisma.tenantInvoice.create({
      data: {
        tenantId: t.id, periodStart: new Date(2026, 4, 1), periodEnd: new Date(2026, 4, 30),
        nbGyms: 1, unitPriceXof: 25000, totalXof: 25000,
        status: InvoiceStatus.PAID, dueDate: new Date(),
      },
    });
    const po = await seedPO();
    const r = await markInvoicePaid({
      invoiceId: inv.id, method: TenantPaymentMethod.MANUAL_TRANSFER, recordedById: po.id, prisma: testPrisma,
    });
    expect(r.success).toBe(false);
  });
});
