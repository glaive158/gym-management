# SaaS Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Plateforme facture 25 000 FCFA/mois/salle aux tenants. Génération auto des factures le 1er du mois. Essai gratuit 14j post-validation. Grâce 7j après échéance puis suspension auto. PLATFORM_OWNER peut marquer payé manuellement (transfert bancaire). Factures PDF téléchargeables.

**Architecture:**
- `TenantInvoice` (période, nbGyms, total, dueDate, statut)
- `TenantPayment` (méthode WAVE/OM/PAYDUNYA/MANUAL_TRANSFER, externalRef, paidAt)
- Cron `/api/cron/generate-invoices` (1er du mois, génère factures pour tenants actifs hors essai)
- Cron `/api/cron/check-overdue` (passe `OVERDUE` après dueDate, suspend après +7j)
- `markInvoicePaid` server action (crée `TenantPayment` + flag `PAID` + réactive tenant si SUSPENDED)
- PDF via `pdfkit` (server-side stream)
- PLATFORM_OWNER UI : liste globale + détail facture + bouton "Marquer payé"
- TENANT_ADMIN UI : ses factures + lien PDF + état du billing (TRIAL/ACTIVE/OVERDUE/SUSPENDED)

**Tech Stack:** Prisma 6, pdfkit, Vitest, Tailwind. Cron protégé par `CRON_SECRET` header.

**Prerequisite:** Plan 5 mergé sur `main`.

---

## File Structure

```
prisma/schema.prisma                                   # +TenantInvoice + TenantPayment + enums
src/lib/
  server-actions/
    billing.ts                                         # generateMonthlyInvoices, checkOverdueInvoices, markInvoicePaid
  pdf-invoice.ts                                       # buildInvoicePdf (returns Buffer)
src/app/
  api/
    cron/
      generate-invoices/route.ts                       # POST cron
      check-overdue/route.ts                           # POST cron
    platform/invoices/[id]/mark-paid/route.ts          # POST
    admin/invoices/[id]/pdf/route.ts                   # GET PDF
    platform/invoices/[id]/pdf/route.ts                # GET PDF
  platform/
    invoices/page.tsx                                  # liste globale
    invoices/[id]/page.tsx                             # détail + bouton mark-paid
  admin/
    billing/page.tsx                                   # ses factures
src/components/
  platform/invoice-status-badge.tsx
tests/lib/server-actions/billing.test.ts               # ~10 tests
```

---

## Task 1: Schema TenantInvoice + TenantPayment

**Files:** Modify `prisma/schema.prisma`. Add migration.

- [ ] **Step 1: Add enums + models**

Append to `prisma/schema.prisma`:
```prisma
enum InvoiceStatus {
  PENDING
  PAID
  OVERDUE
  CANCELLED
}

enum TenantPaymentMethod {
  WAVE
  ORANGE_MONEY
  PAYDUNYA
  MANUAL_TRANSFER
}

model TenantInvoice {
  id              String        @id @default(cuid())
  tenantId        String
  periodStart     DateTime
  periodEnd       DateTime
  nbGyms          Int
  unitPriceXof    Int
  totalXof        Int
  status          InvoiceStatus @default(PENDING)
  dueDate         DateTime
  paidAt          DateTime?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  tenant   Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  payments TenantPayment[]

  @@unique([tenantId, periodStart])
  @@index([status, dueDate])
}

model TenantPayment {
  id              String              @id @default(cuid())
  tenantId        String
  invoiceId       String
  amountXof       Int
  method          TenantPaymentMethod
  externalRef     String?
  recordedById    String?
  paidAt          DateTime            @default(now())
  createdAt       DateTime            @default(now())

  tenant     Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  invoice    TenantInvoice  @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  recordedBy User?          @relation("TenantPaymentRecorder", fields: [recordedById], references: [id])

  @@index([tenantId])
  @@index([invoiceId])
}
```

Add inverse relations:
- `Tenant`: `invoices TenantInvoice[]`, `tenantPayments TenantPayment[]`
- `User`: `recordedTenantPayments TenantPayment[] @relation("TenantPaymentRecorder")`

- [ ] **Step 2: Generate + apply migration**

```bash
MIGRATION_DIR=prisma/migrations/$(date -u +%Y%m%d%H%M%S)_add_billing && mkdir -p $MIGRATION_DIR
npx dotenv -e .env.local -- npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > $MIGRATION_DIR/migration.sql
npx dotenv -e .env.local -- npx prisma migrate deploy
DATABASE_URL="postgresql://admin@localhost:5432/gym_management_test?schema=public" npx prisma migrate deploy
npx dotenv -e .env.local -- npx prisma generate
```

- [ ] **Step 3: Update test reset helper**

In `tests/helpers/db.ts` add at top of `resetDb`:
```typescript
await testPrisma.tenantPayment.deleteMany();
await testPrisma.tenantInvoice.deleteMany();
```

(before `checkIn.deleteMany`)

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(db): add TenantInvoice + TenantPayment models"
```

---

## Task 2: Billing server actions TDD

**Files:** Create `src/lib/server-actions/billing.ts`, `tests/lib/server-actions/billing.test.ts`

- [ ] **Step 1: Failing tests**

`tests/lib/server-actions/billing.test.ts`:
```typescript
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
      trialEndsAt: opts.trialEndsAt ?? new Date(Date.now() - 86400000),
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
```

- [ ] **Step 2: Implement**

`src/lib/server-actions/billing.ts`:
```typescript
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

  // 1) Mark PENDING past due → OVERDUE
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

  // 2) Suspend tenants with OVERDUE invoice past grace
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

  // Check whether tenant has any other OVERDUE invoice; if not, reactivate
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
```

- [ ] **Step 3: Test + commit**

```bash
npm test -- tests/lib/server-actions/billing.test.ts
git add -A && git commit -m "feat: add billing server actions (generate/overdue/markPaid) with tests"
```

---

## Task 3: PDF invoice generator

**Files:** Install `pdfkit`, create `src/lib/pdf-invoice.ts`.

- [ ] **Step 1: Install**

```bash
npm install pdfkit
npm install -D @types/pdfkit
```

- [ ] **Step 2: Implement**

`src/lib/pdf-invoice.ts`:
```typescript
import PDFDocument from "pdfkit";
import type { TenantInvoice, Tenant } from "@prisma/client";

export async function buildInvoicePdf(inv: TenantInvoice & { tenant: Tenant }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Header
      doc.fontSize(20).text("FACTURE", { align: "right" });
      doc.fontSize(10).fillColor("#555").text(`#${inv.id}`, { align: "right" });
      doc.moveDown();

      // From
      doc.fillColor("#000").fontSize(11).text("Gym Management SaaS", { continued: false });
      doc.fontSize(9).fillColor("#555").text("Plateforme SaaS · Sénégal");
      doc.moveDown();

      // To
      doc.fillColor("#000").fontSize(11).text("Facturé à :");
      doc.text(inv.tenant.name);
      doc.fontSize(9).fillColor("#555").text(inv.tenant.ownerEmail);
      doc.text(inv.tenant.city);
      doc.moveDown();

      // Period
      const fmt = (d: Date) => d.toLocaleDateString("fr-FR");
      doc.fillColor("#000").fontSize(10).text(`Période : ${fmt(inv.periodStart)} → ${fmt(inv.periodEnd)}`);
      doc.text(`Échéance : ${fmt(inv.dueDate)}`);
      doc.text(`Statut : ${inv.status}`);
      doc.moveDown();

      // Lines table
      doc.fontSize(11).text("Détail", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).text(`Abonnement plateforme — ${inv.nbGyms} salle${inv.nbGyms > 1 ? "s" : ""}`);
      doc.text(`Prix unitaire : ${inv.unitPriceXof.toLocaleString("fr-FR")} XOF`);
      doc.moveDown();
      doc.fontSize(13).text(`TOTAL : ${inv.totalXof.toLocaleString("fr-FR")} XOF`, { align: "right" });

      // Footer
      doc.moveDown(2);
      doc.fontSize(8).fillColor("#999").text("Paiement par Wave, Orange Money, PayDunya ou virement bancaire.", { align: "center" });

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add PDF invoice generator via pdfkit"
```

---

## Task 4: API routes (cron + mark paid + PDF)

**Files:** Create 4 routes.

- [ ] **Step 1: Env**

Append to `.env.example` and `.env.local`:
```
CRON_SECRET="dev-secret-change-me"
```

- [ ] **Step 2: Cron generate**

`src/app/api/cron/generate-invoices/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateMonthlyInvoices } from "@/lib/server-actions/billing";

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const r = await generateMonthlyInvoices({ periodStart, prisma });
  return NextResponse.json({ ok: true, ...r });
}
```

- [ ] **Step 3: Cron overdue**

`src/app/api/cron/check-overdue/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkOverdueInvoices } from "@/lib/server-actions/billing";

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const r = await checkOverdueInvoices({ prisma });
  return NextResponse.json({ ok: true, ...r });
}
```

- [ ] **Step 4: Mark paid**

`src/app/api/platform/invoices/[id]/mark-paid/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role, TenantPaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { markInvoicePaid } from "@/lib/server-actions/billing";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.PLATFORM_OWNER) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const method = (String(body.method ?? "MANUAL_TRANSFER") as TenantPaymentMethod);
  if (!Object.values(TenantPaymentMethod).includes(method)) return NextResponse.json({ error: "Méthode invalide" }, { status: 400 });
  const r = await markInvoicePaid({
    invoiceId: params.id,
    method,
    externalRef: body.externalRef ? String(body.externalRef) : undefined,
    recordedById: ctx.userId,
    prisma,
  });
  if (!r.success) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: PDF (platform)**

`src/app/api/platform/invoices/[id]/pdf/route.ts`:
```typescript
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildInvoicePdf } from "@/lib/pdf-invoice";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.PLATFORM_OWNER) return new Response("Forbidden", { status: 403 });
  const inv = await prisma.tenantInvoice.findUnique({ where: { id: params.id }, include: { tenant: true } });
  if (!inv) return new Response("Not found", { status: 404 });
  const buf = await buildInvoicePdf(inv);
  return new Response(buf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="facture-${inv.id}.pdf"`,
    },
  });
}
```

- [ ] **Step 6: PDF (admin/tenant)**

`src/app/api/admin/invoices/[id]/pdf/route.ts`:
```typescript
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildInvoicePdf } from "@/lib/pdf-invoice";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.TENANT_ADMIN || !ctx.tenantId) return new Response("Forbidden", { status: 403 });
  const inv = await prisma.tenantInvoice.findUnique({ where: { id: params.id }, include: { tenant: true } });
  if (!inv || inv.tenantId !== ctx.tenantId) return new Response("Not found", { status: 404 });
  const buf = await buildInvoicePdf(inv);
  return new Response(buf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="facture-${inv.id}.pdf"`,
    },
  });
}
```

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: add cron + mark-paid + PDF API routes for billing"
```

---

## Task 5: PLATFORM_OWNER invoices UI

**Files:** Create `src/components/platform/invoice-status-badge.tsx`, `src/app/platform/invoices/page.tsx`, `src/app/platform/invoices/[id]/page.tsx`, `src/app/platform/invoices/[id]/mark-paid-form.tsx`. Update platform nav.

- [ ] **Step 1: Status badge**

`src/components/platform/invoice-status-badge.tsx`:
```tsx
import { InvoiceStatus } from "@prisma/client";

const STYLE: Record<InvoiceStatus, string> = {
  PENDING: "bg-amber-950 text-amber-300 border-amber-900",
  PAID: "bg-green-950 text-green-300 border-green-900",
  OVERDUE: "bg-red-950 text-red-300 border-red-900",
  CANCELLED: "bg-slate-950 text-slate-400 border-slate-800",
};
const LABEL: Record<InvoiceStatus, string> = {
  PENDING: "En attente", PAID: "Payée", OVERDUE: "En retard", CANCELLED: "Annulée",
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span className={`inline-block text-xs font-medium px-2 py-1 rounded border ${STYLE[status]}`}>
      {LABEL[status]}
    </span>
  );
}
```

- [ ] **Step 2: List page**

`src/app/platform/invoices/page.tsx`:
```tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { InvoiceStatusBadge } from "@/components/platform/invoice-status-badge";

export const dynamic = "force-dynamic";

export default async function PlatformInvoicesPage() {
  const invoices = await prisma.tenantInvoice.findMany({
    orderBy: { createdAt: "desc" },
    include: { tenant: true },
    take: 200,
  });
  const totals = await prisma.tenantInvoice.aggregate({
    _sum: { totalXof: true },
    where: { status: "PAID" },
  });
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Factures plateforme</h1>
        <div className="text-sm text-slate-400">
          Encaissé total : <span className="text-green-400 font-bold">{(totals._sum.totalXof ?? 0).toLocaleString("fr-FR")} XOF</span>
        </div>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-400 border-b border-slate-800">
            <tr>
              <th className="px-4 py-3 text-left">Tenant</th>
              <th className="px-4 py-3 text-left">Période</th>
              <th className="px-4 py-3 text-right">Salles</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-left">Échéance</th>
              <th className="px-4 py-3 text-left">Statut</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Aucune facture</td></tr>}
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-slate-800 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-100">{inv.tenant.name}</td>
                <td className="px-4 py-3 text-slate-400">{inv.periodStart.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</td>
                <td className="px-4 py-3 text-right text-slate-300">{inv.nbGyms}</td>
                <td className="px-4 py-3 text-right text-slate-100">{inv.totalXof.toLocaleString("fr-FR")}</td>
                <td className="px-4 py-3 text-slate-400">{inv.dueDate.toLocaleDateString("fr-FR")}</td>
                <td className="px-4 py-3"><InvoiceStatusBadge status={inv.status} /></td>
                <td className="px-4 py-3 text-right"><Link href={`/platform/invoices/${inv.id}`} className="text-blue-400 hover:text-blue-300">Voir →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Detail page + mark-paid form**

`src/app/platform/invoices/[id]/mark-paid-form.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MarkPaidForm({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [method, setMethod] = useState("MANUAL_TRANSFER");
  const [ref, setRef] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/platform/invoices/${invoiceId}/mark-paid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, externalRef: ref || undefined }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Erreur");
      return;
    }
    router.refresh();
  }

  const inputCls = "w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-slate-100 text-sm";
  return (
    <form onSubmit={submit} className="space-y-3 bg-slate-900 border border-slate-800 rounded p-4">
      <h3 className="font-semibold">Marquer payée</h3>
      <div>
        <label className="block text-xs mb-1 text-slate-400">Méthode</label>
        <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="MANUAL_TRANSFER">Virement</option>
          <option value="WAVE">Wave</option>
          <option value="ORANGE_MONEY">Orange Money</option>
          <option value="PAYDUNYA">PayDunya</option>
        </select>
      </div>
      <div>
        <label className="block text-xs mb-1 text-slate-400">Référence transaction (optionnel)</label>
        <input className={inputCls} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Ex : WV-2026-001" />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button type="submit" disabled={loading} className="px-4 py-2 rounded bg-green-600 hover:bg-green-500 disabled:opacity-50 text-sm font-medium">
        {loading ? "..." : "Confirmer paiement"}
      </button>
    </form>
  );
}
```

`src/app/platform/invoices/[id]/page.tsx`:
```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { InvoiceStatusBadge } from "@/components/platform/invoice-status-badge";
import { MarkPaidForm } from "./mark-paid-form";
import { InvoiceStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function InvoiceDetail({ params }: { params: { id: string } }) {
  const inv = await prisma.tenantInvoice.findUnique({
    where: { id: params.id },
    include: { tenant: true, payments: { include: { recordedBy: true } } },
  });
  if (!inv) notFound();

  return (
    <div className="space-y-6">
      <Link href="/platform/invoices" className="text-sm text-slate-400 hover:text-slate-200">← Factures</Link>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{inv.tenant.name}</h1>
          <p className="text-sm text-slate-400 mt-1">Facture <span className="font-mono">{inv.id}</span></p>
        </div>
        <div className="flex items-center gap-3">
          <InvoiceStatusBadge status={inv.status} />
          <a href={`/api/platform/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer" className="px-3 py-1 text-sm rounded bg-slate-800 hover:bg-slate-700">📄 PDF</a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded p-4 space-y-1 text-sm">
          <div className="text-xs uppercase text-slate-400 mb-1">Période</div>
          <div>{inv.periodStart.toLocaleDateString("fr-FR")} → {inv.periodEnd.toLocaleDateString("fr-FR")}</div>
          <div className="text-slate-400">Échéance : {inv.dueDate.toLocaleDateString("fr-FR")}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded p-4 space-y-1 text-sm">
          <div className="text-xs uppercase text-slate-400 mb-1">Détail</div>
          <div>{inv.nbGyms} salle{inv.nbGyms > 1 ? "s" : ""} × {inv.unitPriceXof.toLocaleString("fr-FR")} XOF</div>
          <div className="text-xl font-bold text-green-400 mt-1">{inv.totalXof.toLocaleString("fr-FR")} XOF</div>
        </div>
      </div>

      {inv.payments.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded p-4">
          <h2 className="font-semibold mb-3">Paiements</h2>
          <ul className="text-sm space-y-2">
            {inv.payments.map((p) => (
              <li key={p.id} className="flex justify-between border-b border-slate-800 pb-2 last:border-0">
                <span>
                  {p.method} · {p.paidAt.toLocaleDateString("fr-FR")}
                  {p.externalRef && <span className="text-slate-400 ml-2">({p.externalRef})</span>}
                  {p.recordedBy && <span className="text-slate-500 ml-2">par {p.recordedBy.name}</span>}
                </span>
                <span className="text-green-400">{p.amountXof.toLocaleString("fr-FR")} XOF</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {inv.status !== InvoiceStatus.PAID && inv.status !== InvoiceStatus.CANCELLED && (
        <MarkPaidForm invoiceId={inv.id} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Nav link**

In `src/components/platform/nav.tsx`, after the Tenants link, add:
```tsx
<Link href="/platform/invoices" className="text-sm text-slate-400 hover:text-slate-200">Factures</Link>
```

- [ ] **Step 5: Build + commit**

```bash
npm run build
git add -A && git commit -m "feat: add PLATFORM_OWNER invoices list + detail + mark-paid UI"
```

---

## Task 6: TENANT_ADMIN billing page

**Files:** Create `src/app/admin/billing/page.tsx`. Update admin nav.

- [ ] **Step 1: Page**

`src/app/admin/billing/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { InvoiceStatusBadge } from "@/components/platform/invoice-status-badge";

export const dynamic = "force-dynamic";

const BILLING_LABEL: Record<string, string> = {
  TRIAL: "Essai gratuit",
  ACTIVE: "Actif",
  OVERDUE: "En retard",
  SUSPENDED: "Suspendu",
};

export default async function BillingPage() {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId) redirect("/login");

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } });
  const invoices = await prisma.tenantInvoice.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: { periodStart: "desc" },
  });
  const totalPaid = invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + i.totalXof, 0);
  const totalDue = invoices.filter((i) => i.status === "PENDING" || i.status === "OVERDUE").reduce((s, i) => s + i.totalXof, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Facturation</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded p-4">
          <div className="text-xs uppercase text-slate-400">Statut</div>
          <div className="text-xl font-bold mt-1 text-slate-100">{BILLING_LABEL[tenant.billingStatus]}</div>
          {tenant.trialEndsAt && tenant.trialEndsAt > new Date() && (
            <div className="text-xs text-amber-400 mt-1">Essai jusqu&apos;au {tenant.trialEndsAt.toLocaleDateString("fr-FR")}</div>
          )}
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded p-4">
          <div className="text-xs uppercase text-slate-400">Encaissé</div>
          <div className="text-xl font-bold mt-1 text-green-400">{totalPaid.toLocaleString("fr-FR")} XOF</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded p-4">
          <div className="text-xs uppercase text-slate-400">À payer</div>
          <div className="text-xl font-bold mt-1 text-amber-400">{totalDue.toLocaleString("fr-FR")} XOF</div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-400 border-b border-slate-800">
            <tr>
              <th className="px-4 py-3 text-left">Période</th>
              <th className="px-4 py-3 text-right">Salles</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-left">Échéance</th>
              <th className="px-4 py-3 text-left">Statut</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Aucune facture (essai en cours)</td></tr>}
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-slate-800 last:border-0">
                <td className="px-4 py-3 text-slate-100">{inv.periodStart.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</td>
                <td className="px-4 py-3 text-right text-slate-300">{inv.nbGyms}</td>
                <td className="px-4 py-3 text-right text-slate-100">{inv.totalXof.toLocaleString("fr-FR")}</td>
                <td className="px-4 py-3 text-slate-400">{inv.dueDate.toLocaleDateString("fr-FR")}</td>
                <td className="px-4 py-3"><InvoiceStatusBadge status={inv.status} /></td>
                <td className="px-4 py-3 text-right">
                  <a href={`/api/admin/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 text-sm">📄 PDF</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalDue > 0 && (
        <div className="bg-amber-950 border border-amber-900 rounded p-4 text-sm text-amber-200">
          Pour payer une facture en attente, contactez la plateforme par Wave, Orange Money, PayDunya ou virement bancaire.
          Le règlement sera confirmé sous 24h.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Admin nav link**

In the admin nav (likely `src/components/admin/nav.tsx`), add:
```tsx
<Link href="/admin/billing" className="text-sm text-slate-400 hover:text-slate-200">Facturation</Link>
```

(Match existing nav file structure.)

- [ ] **Step 3: Build + commit**

```bash
npm run build
git add -A && git commit -m "feat: add TENANT_ADMIN /admin/billing page"
```

---

## Task 7: End-to-end verification

- [ ] **Step 1: All tests + build**

```bash
npm test
npm run typecheck
npm run build
```
Expected: all green, +~10 new billing tests → 110 total.

- [ ] **Step 2: Manual cron simulation**

```bash
npm run dev &
sleep 5
curl -X POST -H "x-cron-secret: dev-secret-change-me" http://localhost:3000/api/cron/generate-invoices
curl -X POST -H "x-cron-secret: dev-secret-change-me" http://localhost:3000/api/cron/check-overdue
pkill -f "next dev"
```

- [ ] **Step 3: Final commit**

```bash
git add -A && git commit --allow-empty -m "chore: SaaS billing milestone (Plan 6)"
```

---

## Done criteria
- 10 new billing tests pass
- `npm run build` succeeds
- PLATFORM_OWNER list + detail + mark-paid working
- TENANT_ADMIN billing page renders factures + PDF download
- Cron routes protected by `CRON_SECRET` header
- PDF générée via pdfkit
