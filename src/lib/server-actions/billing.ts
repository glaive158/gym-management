import {
  PrismaClient, InvoiceStatus, TenantStatus, BillingStatus, TenantPaymentMethod,
} from "@prisma/client";

const DUE_DAYS = 7;
const GRACE_DAYS = 7;

function endOfMonth(periodStart: Date): Date {
  return new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0, 23, 59, 59, 999);
}

export interface GenerateInvoicesInput {
  periodStart: Date;
  prisma: PrismaClient;
}

export async function generateMonthlyInvoices(input: GenerateInvoicesInput): Promise<{ created: number }> {
  const periodStart = new Date(input.periodStart.getFullYear(), input.periodStart.getMonth(), 1);
  const periodEnd = endOfMonth(periodStart);
  const now = new Date();

  const tenants = await input.prisma.tenant.findMany({
    where: {
      status: TenantStatus.ACTIVE,
      isBeta: false,
      OR: [{ trialEndsAt: null }, { trialEndsAt: { lt: now } }],
    },
    include: { gyms: true },
  });

  let created = 0;
  for (const t of tenants) {
    const nbGyms = t.gyms.length;
    if (nbGyms === 0) continue;

    const existing = await input.prisma.tenantInvoice.findUnique({
      where: { tenantId_periodStart: { tenantId: t.id, periodStart } },
    });
    if (existing) continue;

    const unitPrice = t.monthlyPricePerGym;
    const total = unitPrice * nbGyms;
    const dueDate = new Date(periodStart);
    dueDate.setDate(dueDate.getDate() + DUE_DAYS);

    await input.prisma.tenantInvoice.create({
      data: {
        tenantId: t.id,
        periodStart, periodEnd,
        nbGyms, unitPriceXof: unitPrice, totalXof: total,
        status: InvoiceStatus.PENDING,
        dueDate,
      },
    });
    created += 1;
  }
  return { created };
}

export async function checkOverdueInvoices(input: { prisma: PrismaClient }): Promise<{ markedOverdue: number; suspended: number }> {
  const now = new Date();

  const pending = await input.prisma.tenantInvoice.findMany({
    where: { status: InvoiceStatus.PENDING, dueDate: { lt: now } },
  });
  for (const inv of pending) {
    await input.prisma.tenantInvoice.update({
      where: { id: inv.id },
      data: { status: InvoiceStatus.OVERDUE },
    });
    await input.prisma.tenant.update({
      where: { id: inv.tenantId },
      data: { billingStatus: BillingStatus.OVERDUE },
    });
  }
  const markedOverdue = pending.length;

  const overdueGraceCutoff = new Date(now.getTime() - GRACE_DAYS * 86400000);
  const toSuspend = await input.prisma.tenantInvoice.findMany({
    where: {
      status: InvoiceStatus.OVERDUE,
      dueDate: { lt: overdueGraceCutoff },
      tenant: { status: TenantStatus.ACTIVE },
    },
    select: { tenantId: true },
    distinct: ["tenantId"],
  });
  for (const row of toSuspend) {
    await input.prisma.tenant.update({
      where: { id: row.tenantId },
      data: { status: TenantStatus.SUSPENDED, billingStatus: BillingStatus.SUSPENDED },
    });
  }
  return { markedOverdue, suspended: toSuspend.length };
}

export interface MarkInvoicePaidInput {
  invoiceId: string;
  method: TenantPaymentMethod;
  externalRef?: string;
  recordedById?: string;
  prisma: PrismaClient;
}

export async function markInvoicePaid(input: MarkInvoicePaidInput): Promise<{ success: boolean; error?: string }> {
  const inv = await input.prisma.tenantInvoice.findUnique({ where: { id: input.invoiceId } });
  if (!inv) return { success: false, error: "Facture introuvable" };
  if (inv.status === InvoiceStatus.PAID) return { success: false, error: "Facture déjà payée" };
  if (inv.status === InvoiceStatus.CANCELLED) return { success: false, error: "Facture annulée" };

  await input.prisma.$transaction([
    input.prisma.tenantInvoice.update({
      where: { id: inv.id },
      data: { status: InvoiceStatus.PAID, paidAt: new Date() },
    }),
    input.prisma.tenantPayment.create({
      data: {
        tenantId: inv.tenantId,
        invoiceId: inv.id,
        amountXof: inv.totalXof,
        method: input.method,
        externalRef: input.externalRef,
        recordedById: input.recordedById,
      },
    }),
  ]);

  const otherUnpaid = await input.prisma.tenantInvoice.count({
    where: {
      tenantId: inv.tenantId,
      status: { in: [InvoiceStatus.OVERDUE, InvoiceStatus.PENDING] },
      id: { not: inv.id },
    },
  });
  if (otherUnpaid === 0) {
    await input.prisma.tenant.update({
      where: { id: inv.tenantId },
      data: { status: TenantStatus.ACTIVE, billingStatus: BillingStatus.ACTIVE },
    });
  }

  return { success: true };
}
