# Member Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let managers record member payments (Wave, Orange Money, PayDunya, Cash, TPE) linked to subscriptions, with a payment history page and dashboard stats.

**Architecture:** Manual payment recording — manager enters amount, method, and optional transaction reference. Payment model links to Subscription+Member+Gym with tenantId for isolation. No live payment gateway APIs in this plan (Wave/OM/PayDunya are payment method labels only).

**Tech Stack:** Prisma migration, Next.js server actions, App Router server/client components, vitest + real PostgreSQL test DB.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `prisma/schema.prisma` | Modify | Add `PaymentMethod` enum + `Payment` model |
| `tests/helpers/db.ts` | Modify | Add `payment.deleteMany()` to `resetDb` |
| `src/lib/server-actions/payment-crud.ts` | Create | `createPayment`, `listPayments`, `getPayment` |
| `tests/lib/server-actions/payment-crud.test.ts` | Create | Unit tests for payment CRUD |
| `src/components/manager/payment-form.tsx` | Create | Client component: record a payment for a subscription |
| `src/app/manager/payments/page.tsx` | Create | List all payments for manager's gym |
| `src/app/manager/members/[id]/page.tsx` | Modify | Add payment section below subscriptions |
| `src/app/manager/page.tsx` | Modify | Add "Encaissements du mois" stat card |
| `src/components/manager/nav.tsx` | Modify | Add "Paiements" nav link |

---

### Task 1: Schema — PaymentMethod enum + Payment model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add enum and model to schema**

In `prisma/schema.prisma`, add after the `SubscriptionStatus` enum and before `model Tenant`:

```prisma
enum PaymentMethod {
  WAVE
  ORANGE_MONEY
  PAYDUNYA
  CASH
  TPE
}
```

Add the `Payment` model after `model Subscription { ... }`:

```prisma
model Payment {
  id             String        @id @default(cuid())
  tenantId       String
  gymId          String
  memberId       String
  subscriptionId String
  amount         Int
  currency       String        @default("XOF")
  method         PaymentMethod
  reference      String?
  notes          String?
  paidAt         DateTime      @default(now())
  createdAt      DateTime      @default(now())

  tenant         Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  gym            Gym           @relation(fields: [gymId], references: [id], onDelete: Cascade)
  member         User          @relation("MemberPayments", fields: [memberId], references: [id], onDelete: Cascade)
  subscription   Subscription  @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([gymId])
  @@index([memberId])
  @@index([subscriptionId])
}
```

Add back-relations to existing models:

In `model Tenant { ... }` add: `payments Payment[]`
In `model Gym { ... }` add: `payments Payment[]`
In `model Subscription { ... }` add: `payments Payment[]`
In `model User { ... }` add: `payments Payment[] @relation("MemberPayments")`

Also add `tenantId` to the `TENANT_SCOPED_MODELS` set in `src/lib/prisma-tenant.ts` — **check** that `"Payment"` needs to be added.

- [ ] **Step 2: Update prisma-tenant.ts to scope Payment queries**

In `src/lib/prisma-tenant.ts`, update the set:

```typescript
const TENANT_SCOPED_MODELS = new Set(["Gym", "User", "Plan", "Subscription", "Payment"]);
```

- [ ] **Step 3: Run migration**

```bash
cd /Users/admin/gym-management
npm run db:migrate
```

When prompted for migration name: `add_payment_model`

Expected: migration file created, Prisma client regenerated.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/prisma-tenant.ts
git commit -m "feat: add Payment model and PaymentMethod enum"
```

---

### Task 2: Update resetDb helper

**Files:**
- Modify: `tests/helpers/db.ts`

- [ ] **Step 1: Add payment.deleteMany() as first delete in resetDb**

Current `resetDb` deletes in order: subscription → plan → user → gym → tenant.
Payment must be deleted first (it references subscription, user, gym).

Replace the `resetDb` function:

```typescript
export async function resetDb(): Promise<void> {
  await testPrisma.payment.deleteMany();
  await testPrisma.subscription.deleteMany();
  await testPrisma.plan.deleteMany();
  await testPrisma.user.deleteMany();
  await testPrisma.gym.deleteMany();
  await testPrisma.tenant.deleteMany();
}
```

- [ ] **Step 2: Run existing tests to confirm nothing broken**

```bash
npm test
```

Expected: 75 passed (all existing tests still pass).

- [ ] **Step 3: Commit**

```bash
git add tests/helpers/db.ts
git commit -m "chore: add payment.deleteMany to resetDb"
```

---

### Task 3: payment-crud server actions

**Files:**
- Create: `src/lib/server-actions/payment-crud.ts`

- [ ] **Step 1: Write the failing test first (see Task 4 — do Task 4 before this)**

Skip ahead to Task 4, write the tests, run them (they'll fail), then return here to implement.

- [ ] **Step 2: Create payment-crud.ts**

```typescript
import { PrismaClient, PaymentMethod, Role } from "@prisma/client";
import { tenantPrisma } from "@/lib/prisma-tenant";

export interface CreatePaymentInput {
  tenantId: string;
  gymId: string;
  memberId: string;
  subscriptionId: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
  paidAt?: Date;
  prisma: PrismaClient;
}

export interface CreatePaymentResult {
  success: boolean;
  paymentId?: string;
  error?: string;
}

export async function createPayment(
  input: CreatePaymentInput
): Promise<CreatePaymentResult> {
  const scoped = tenantPrisma(input.prisma, input.tenantId);

  if (input.amount <= 0) {
    return { success: false, error: "Le montant doit être positif" };
  }

  const member = await scoped.user.findUnique({ where: { id: input.memberId } });
  if (!member || member.role !== Role.MEMBER) {
    return { success: false, error: "Membre introuvable dans cette organisation" };
  }

  const sub = await scoped.subscription.findUnique({ where: { id: input.subscriptionId } });
  if (!sub || sub.memberId !== input.memberId) {
    return { success: false, error: "Abonnement introuvable ou ne correspond pas au membre" };
  }

  const payment = await (scoped as any).payment.create({
    data: {
      gymId: input.gymId,
      memberId: input.memberId,
      subscriptionId: input.subscriptionId,
      amount: Math.round(input.amount),
      method: input.method,
      reference: input.reference ?? null,
      notes: input.notes ?? null,
      paidAt: input.paidAt ?? new Date(),
    },
  });

  return { success: true, paymentId: payment.id };
}

export interface ListPaymentsInput {
  tenantId: string;
  gymId?: string;
  memberId?: string;
  prisma: PrismaClient;
}

export interface PaymentSummary {
  id: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  paidAt: Date;
  memberName: string;
  memberAvatar: string | null;
  subscriptionId: string;
}

export async function listPayments(
  input: ListPaymentsInput
): Promise<PaymentSummary[]> {
  const scoped = tenantPrisma(input.prisma, input.tenantId);
  const where: Record<string, unknown> = {};
  if (input.gymId) where.gymId = input.gymId;
  if (input.memberId) where.memberId = input.memberId;

  const payments = await (scoped as any).payment.findMany({
    where,
    include: { member: { select: { name: true, avatar: true } } },
    orderBy: { paidAt: "desc" },
  });

  return payments.map((p: any) => ({
    id: p.id,
    amount: p.amount,
    currency: p.currency,
    method: p.method,
    reference: p.reference,
    notes: p.notes,
    paidAt: p.paidAt,
    memberName: p.member.name,
    memberAvatar: p.member.avatar,
    subscriptionId: p.subscriptionId,
  }));
}

export interface MonthlyTotal {
  total: number;
  count: number;
}

export async function getMonthlyPaymentTotal(input: {
  tenantId: string;
  gymId: string;
  year: number;
  month: number; // 1-12
  prisma: PrismaClient;
}): Promise<MonthlyTotal> {
  const start = new Date(input.year, input.month - 1, 1);
  const end = new Date(input.year, input.month, 1);

  const scoped = tenantPrisma(input.prisma, input.tenantId);
  const payments = await (scoped as any).payment.findMany({
    where: {
      gymId: input.gymId,
      paidAt: { gte: start, lt: end },
    },
    select: { amount: true },
  });

  return {
    total: payments.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0),
    count: payments.length,
  };
}
```

- [ ] **Step 3: Run tests**

```bash
npm test tests/lib/server-actions/payment-crud.test.ts
```

Expected: all payment-crud tests pass.

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server-actions/payment-crud.ts
git commit -m "feat: add payment-crud server actions"
```

---

### Task 4: Tests for payment-crud

**Files:**
- Create: `tests/lib/server-actions/payment-crud.test.ts`

- [ ] **Step 1: Write tests**

```typescript
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
    expect(list[0].amount).toBe(25000); // most recent first
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
```

- [ ] **Step 2: Run tests (expect failure — payment-crud.ts not yet created)**

```bash
npm test tests/lib/server-actions/payment-crud.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/server-actions/payment-crud'`

Now go implement Task 3, then return.

- [ ] **Step 3: After Task 3 implementation, run tests again**

```bash
npm test tests/lib/server-actions/payment-crud.test.ts
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/lib/server-actions/payment-crud.test.ts
git commit -m "test: add payment-crud tests"
```

---

### Task 5: PaymentForm client component

**Files:**
- Create: `src/components/manager/payment-form.tsx`

This component renders a form to record a payment for a given subscription. It POSTs to `/api/manager/payments`.

- [ ] **Step 1: Create the API route**

Create `src/app/api/manager/payments/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { createPayment } from "@/lib/server-actions/payment-crud";
import { PaymentMethod } from "@prisma/client";

export async function POST(req: NextRequest) {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId || !ctx.gymId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Corps invalide" }, { status: 400 });

  const { memberId, subscriptionId, amount, method, reference, notes } = body;

  if (!memberId || !subscriptionId || !amount || !method) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  const validMethods = Object.values(PaymentMethod);
  if (!validMethods.includes(method)) {
    return NextResponse.json({ error: "Méthode de paiement invalide" }, { status: 400 });
  }

  const result = await createPayment({
    tenantId: ctx.tenantId,
    gymId: ctx.gymId,
    memberId,
    subscriptionId,
    amount: Number(amount),
    method: method as PaymentMethod,
    reference: reference || undefined,
    notes: notes || undefined,
    prisma,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({ paymentId: result.paymentId }, { status: 201 });
}
```

- [ ] **Step 2: Create the PaymentForm component**

Create `src/components/manager/payment-form.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const METHODS = [
  { value: "WAVE", label: "Wave" },
  { value: "ORANGE_MONEY", label: "Orange Money" },
  { value: "PAYDUNYA", label: "PayDunya" },
  { value: "CASH", label: "Espèces" },
  { value: "TPE", label: "TPE (carte)" },
];

const NEEDS_REF = new Set(["WAVE", "ORANGE_MONEY", "PAYDUNYA"]);

export function PaymentForm({
  memberId,
  subscriptions,
}: {
  memberId: string;
  subscriptions: Array<{
    id: string;
    planName: string;
    endDate: string;
    amount: number;
    currency: string;
  }>;
}) {
  const router = useRouter();
  const [subscriptionId, setSubscriptionId] = useState(subscriptions[0]?.id ?? "");
  const [amount, setAmount] = useState(subscriptions[0]?.amount.toString() ?? "");
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function onSubChange(id: string) {
    setSubscriptionId(id);
    const sub = subscriptions.find((s) => s.id === id);
    if (sub) setAmount(sub.amount.toString());
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/manager/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, subscriptionId, amount: Number(amount), method, reference, notes }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Erreur");
      return;
    }
    setSuccess(true);
    router.refresh();
  }

  if (subscriptions.length === 0) {
    return <p className="text-sm text-amber-400">Aucun abonnement actif. Attribuez d&apos;abord un abonnement.</p>;
  }

  if (success) {
    return (
      <div className="text-sm text-green-400 flex items-center gap-2">
        ✓ Paiement enregistré.{" "}
        <button onClick={() => { setSuccess(false); setReference(""); setNotes(""); }} className="underline">
          Enregistrer un autre
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Abonnement</label>
          <select
            value={subscriptionId}
            onChange={(e) => onSubChange(e.target.value)}
            className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100 text-sm"
          >
            {subscriptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.planName} — jusqu&apos;au {new Date(s.endDate).toLocaleDateString("fr-FR")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Montant (XOF)</label>
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Méthode</label>
          <select
            value={method}
            onChange={(e) => { setMethod(e.target.value); setReference(""); }}
            className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100 text-sm"
          >
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        {NEEDS_REF.has(method) && (
          <div>
            <label className="block text-xs text-slate-400 mb-1">Référence transaction</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="ex: WAVE-TXN-12345"
              className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100 text-sm"
            />
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">Notes (optionnel)</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="ex: paiement partiel, report…"
          className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100 text-sm"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded bg-green-700 hover:bg-green-600 disabled:opacity-50 text-sm font-medium"
        >
          {loading ? "..." : "Enregistrer le paiement"}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/manager/payments/route.ts src/components/manager/payment-form.tsx
git commit -m "feat: add PaymentForm component and payments API route"
```

---

### Task 6: /manager/payments list page

**Files:**
- Create: `src/app/manager/payments/page.tsx`

- [ ] **Step 1: Create the payments list page**

```typescript
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { listPayments } from "@/lib/server-actions/payment-crud";

export const dynamic = "force-dynamic";

const METHOD_LABELS: Record<string, string> = {
  WAVE: "Wave",
  ORANGE_MONEY: "Orange Money",
  PAYDUNYA: "PayDunya",
  CASH: "Espèces",
  TPE: "TPE",
};

export default async function PaymentsPage() {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId || !ctx.gymId) redirect("/login");

  const payments = await listPayments({
    tenantId: ctx.tenantId,
    gymId: ctx.gymId,
    prisma,
  });

  const total = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Paiements ({payments.length})</h1>
        <div className="text-right">
          <div className="text-xs text-slate-400 uppercase">Total encaissé</div>
          <div className="text-xl font-bold text-green-400">
            {total.toLocaleString("fr-FR")} XOF
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-400 border-b border-slate-800">
            <tr>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Membre</th>
              <th className="px-4 py-3 text-left">Méthode</th>
              <th className="px-4 py-3 text-left">Référence</th>
              <th className="px-4 py-3 text-right">Montant</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Aucun paiement enregistré.
                </td>
              </tr>
            )}
            {payments.map((p) => (
              <tr key={p.id} className="border-b border-slate-800 last:border-0">
                <td className="px-4 py-3 text-slate-400">
                  {new Date(p.paidAt).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-4 py-3 text-slate-100">{p.memberName}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300">
                    {METHOD_LABELS[p.method] ?? p.method}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                  {p.reference ?? "—"}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-100">
                  {p.amount.toLocaleString("fr-FR")} {p.currency}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/manager/payments/page.tsx
git commit -m "feat: add /manager/payments list page"
```

---

### Task 7: Update member detail page

Add a "Paiements" section below the subscriptions table, and a payment recording form.

**Files:**
- Modify: `src/app/manager/members/[id]/page.tsx`

- [ ] **Step 1: Update the page to load payments and pass subscription data to PaymentForm**

Replace the entire file content:

```typescript
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { tenantPrisma } from "@/lib/prisma-tenant";
import { listPlans } from "@/lib/server-actions/plan-crud";
import { listPayments } from "@/lib/server-actions/payment-crud";
import { SubscriptionAssign } from "@/components/manager/subscription-assign";
import { PaymentForm } from "@/components/manager/payment-form";
import { SubscriptionStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const METHOD_LABELS: Record<string, string> = {
  WAVE: "Wave",
  ORANGE_MONEY: "Orange Money",
  PAYDUNYA: "PayDunya",
  CASH: "Espèces",
  TPE: "TPE",
};

export default async function MemberDetail({ params }: { params: { id: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId || !ctx.gymId) redirect("/login");

  const scoped = tenantPrisma(prisma, ctx.tenantId);
  const member = await scoped.user.findUnique({
    where: { id: params.id },
    include: {
      subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!member || member.role !== "MEMBER") notFound();

  const [plans, payments] = await Promise.all([
    listPlans({ tenantId: ctx.tenantId, gymId: ctx.gymId, prisma }),
    listPayments({ tenantId: ctx.tenantId, memberId: member.id, prisma }),
  ]);

  const activeSubscriptions = member.subscriptions
    .filter((s) => s.status === SubscriptionStatus.ACTIVE)
    .map((s) => ({
      id: s.id,
      planName: s.plan.name,
      endDate: s.endDate.toISOString(),
      amount: s.plan.price,
      currency: s.plan.currency,
    }));

  return (
    <div className="space-y-8">
      <Link href="/manager/members" className="text-sm text-slate-400 hover:text-slate-200">
        ← Membres
      </Link>

      <div className="flex items-start gap-4">
        {member.avatar
          /* eslint-disable-next-line @next/next/no-img-element */
          ? <img src={member.avatar} alt={member.name} className="w-24 h-24 object-cover rounded" />
          : <div className="w-24 h-24 bg-slate-800 rounded" />}
        <div>
          <h1 className="text-2xl font-semibold">{member.name}</h1>
          <p className="text-sm text-slate-400">{member.email} · {member.phone}</p>
          <p className="text-xs text-slate-500 mt-1">Statut : {member.status}</p>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Abonnements</h2>
        {member.subscriptions.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun abonnement.</p>
        ) : (
          <table className="w-full text-sm bg-slate-900 border border-slate-800 rounded overflow-hidden">
            <thead className="text-xs uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-2 text-left">Formule</th>
                <th className="px-4 py-2 text-left">Du</th>
                <th className="px-4 py-2 text-left">Au</th>
                <th className="px-4 py-2 text-left">Statut</th>
              </tr>
            </thead>
            <tbody>
              {member.subscriptions.map((s) => (
                <tr key={s.id} className="border-b border-slate-800 last:border-0">
                  <td className="px-4 py-2 text-slate-200">{s.plan.name}</td>
                  <td className="px-4 py-2 text-slate-400">{s.startDate.toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-2 text-slate-400">{s.endDate.toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-2 text-slate-300">{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Attribuer un abonnement</h2>
        <SubscriptionAssign
          memberId={member.id}
          plans={plans.map((p) => ({
            id: p.id, name: p.name, durationDays: p.durationDays,
            price: p.price, currency: p.currency,
          }))}
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Enregistrer un paiement</h2>
        <PaymentForm memberId={member.id} subscriptions={activeSubscriptions} />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Historique paiements ({payments.length})</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun paiement enregistré.</p>
        ) : (
          <table className="w-full text-sm bg-slate-900 border border-slate-800 rounded overflow-hidden">
            <thead className="text-xs uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Méthode</th>
                <th className="px-4 py-2 text-left">Référence</th>
                <th className="px-4 py-2 text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-slate-800 last:border-0">
                  <td className="px-4 py-2 text-slate-400">
                    {new Date(p.paidAt).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-2">
                    <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300">
                      {METHOD_LABELS[p.method] ?? p.method}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-400 font-mono text-xs">
                    {p.reference ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-right font-semibold text-slate-100">
                    {p.amount.toLocaleString("fr-FR")} {p.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/manager/members/[id]/page.tsx
git commit -m "feat: add payment section to member detail page"
```

---

### Task 8: Update manager dashboard with payment stats

**Files:**
- Modify: `src/app/manager/page.tsx`

- [ ] **Step 1: Add monthly payment total to dashboard**

Replace the entire file:

```typescript
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { tenantPrisma } from "@/lib/prisma-tenant";
import { getMonthlyPaymentTotal } from "@/lib/server-actions/payment-crud";
import { SubscriptionStatus, Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function ManagerDashboard() {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId || !ctx.gymId) redirect("/login");

  const scoped = tenantPrisma(prisma, ctx.tenantId);
  const gym = await scoped.gym.findUnique({ where: { id: ctx.gymId } });
  if (!gym) redirect("/login");

  const now = new Date();
  const [memberCount, activeSubs, plans, monthlyTotal] = await Promise.all([
    scoped.user.count({ where: { role: Role.MEMBER } }),
    scoped.subscription.count({ where: { status: SubscriptionStatus.ACTIVE } }),
    scoped.plan.count({ where: { gymId: ctx.gymId, isActive: true } }),
    getMonthlyPaymentTotal({
      tenantId: ctx.tenantId,
      gymId: ctx.gymId,
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      prisma,
    }),
  ]);

  const monthName = now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{gym.name}</h1>
        <p className="text-sm text-slate-400">{gym.address}, {gym.city}</p>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="bg-slate-900 border border-slate-800 rounded p-4">
          <div className="text-xs text-slate-400 uppercase">Membres</div>
          <div className="text-3xl font-bold text-slate-100 mt-1">{memberCount}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded p-4">
          <div className="text-xs text-slate-400 uppercase">Abonnements actifs</div>
          <div className="text-3xl font-bold text-green-400 mt-1">{activeSubs}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded p-4">
          <div className="text-xs text-slate-400 uppercase">Formules disponibles</div>
          <div className="text-3xl font-bold text-blue-400 mt-1">{plans}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded p-4">
          <div className="text-xs text-slate-400 uppercase truncate">Encaissé {monthName}</div>
          <div className="text-2xl font-bold text-yellow-400 mt-1">
            {monthlyTotal.total.toLocaleString("fr-FR")}
            <span className="text-sm font-normal text-slate-400 ml-1">XOF</span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{monthlyTotal.count} paiement{monthlyTotal.count > 1 ? "s" : ""}</div>
        </div>
      </div>
      <div className="text-sm text-slate-400">
        Le dashboard temps réel des check-ins arrive dans le plan suivant.
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/manager/page.tsx
git commit -m "feat: add monthly payment total to manager dashboard"
```

---

### Task 9: Update navigation

**Files:**
- Modify: `src/components/manager/nav.tsx`

- [ ] **Step 1: Add Paiements link to ManagerNav**

Replace `nav.tsx`:

```typescript
import Link from "next/link";
import { SignOutButton } from "@/components/platform/sign-out-button";

export function ManagerNav() {
  return (
    <nav className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/manager" className="font-semibold text-slate-100">Manager</Link>
        <Link href="/manager" className="text-sm text-slate-400 hover:text-slate-200">Dashboard</Link>
        <Link href="/manager/members" className="text-sm text-slate-400 hover:text-slate-200">Membres</Link>
        <Link href="/manager/plans" className="text-sm text-slate-400 hover:text-slate-200">Formules</Link>
        <Link href="/manager/payments" className="text-sm text-slate-400 hover:text-slate-200">Paiements</Link>
      </div>
      <SignOutButton />
    </nav>
  );
}
```

- [ ] **Step 2: Run full test suite**

```bash
npm test
```

Expected: all tests pass (75 existing + new payment-crud tests).

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/manager/nav.tsx
git commit -m "feat: add Paiements link to manager nav"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Task |
|-----------------|------|
| Payment model (WAVE/OM/PAYDUNYA/CASH/TPE) | Task 1 |
| Manager records payment | Tasks 5, 7 |
| Payment linked to subscription | Task 1 (schema), Task 3 |
| Payment history per member | Task 7 |
| Payment list for gym | Task 6 |
| Stats on dashboard | Task 8 |
| Tenant isolation on payments | Task 2 + tenantPrisma scope |

### Placeholder scan

No TBD, TODO, or incomplete steps found.

### Type consistency

- `createPayment` returns `{ success, paymentId?, error? }` — consistent across Task 3 and Task 5 API route.
- `listPayments` returns `PaymentSummary[]` — used as-is in Task 6 and Task 7.
- `getMonthlyPaymentTotal` returns `{ total, count }` — used in Task 8.
- `PaymentForm` receives `subscriptions: Array<{id, planName, endDate, amount, currency}>` — built in Task 7 from `activeSubscriptions`.
- `tenantPrisma` wraps `Payment` model after Task 1 adds `"Payment"` to `TENANT_SCOPED_MODELS`.
