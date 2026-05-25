# Notifications + Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:**
- **Notifications** : alertes membres J-7, J-3, J-0 avant expiration de leur abonnement (email Resend + WhatsApp). Anti-spam (1 notif par seuil par subscription).
- **Rapports** : MANAGER voit stats de sa salle (revenus mensuel, présences, nouveaux membres, top membres) ; TENANT_ADMIN voit agrégat de toutes ses salles. Export CSV.

**Architecture:**
- `NotificationLog` entity (memberId, subscriptionId, type, channel, sentAt) → anti-spam
- WhatsApp wrapper (fallback console comme Resend)
- Cron `/api/cron/expiration-notifications` (quotidien)
- Server actions : `sendExpirationNotifications`, `getManagerReport`, `getTenantReport`
- CSV helper `toCsv(rows, columns)`
- Routes export CSV (manager + tenant)
- Pages `/manager/reports` + `/admin/reports`

**Tech Stack:** Prisma 6, Vitest, Tailwind. WhatsApp via Cloud API (axios fetch). Anti-spam = unique `(subscriptionId, type)` index.

**Prerequisite:** Plan 6 mergé sur `main`.

---

## File Structure

```
prisma/schema.prisma                                           # +NotificationLog + enum
src/lib/
  whatsapp.ts                                                  # sendWhatsApp (dev console fallback)
  csv.ts                                                       # toCsv
  server-actions/
    notifications.ts                                           # sendExpirationNotifications
    reports.ts                                                 # getManagerReport, getTenantReport
src/app/
  api/
    cron/expiration-notifications/route.ts                     # POST cron
    manager/reports/payments.csv/route.ts                      # GET CSV
    manager/reports/checkins.csv/route.ts                      # GET CSV
    admin/reports/by-gym.csv/route.ts                          # GET CSV
  manager/reports/page.tsx                                     # UI
  admin/reports/page.tsx                                       # UI
tests/lib/
  csv.test.ts
  server-actions/
    notifications.test.ts
    reports.test.ts
```

---

## Task 1: Schema NotificationLog

**Files:** Modify `prisma/schema.prisma`. Update test reset helper.

- [ ] **Step 1: Enums + model**

Append to `prisma/schema.prisma`:
```prisma
enum NotificationType {
  EXPIRATION_J7
  EXPIRATION_J3
  EXPIRATION_J0
}

enum NotificationChannel {
  EMAIL
  WHATSAPP
}

model NotificationLog {
  id             String              @id @default(cuid())
  tenantId       String
  memberId       String
  subscriptionId String
  type           NotificationType
  channel        NotificationChannel
  sentAt         DateTime            @default(now())
  success        Boolean             @default(true)
  errorMessage   String?

  tenant       Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  member       User         @relation("MemberNotifications", fields: [memberId], references: [id], onDelete: Cascade)
  subscription Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)

  @@unique([subscriptionId, type, channel])
  @@index([tenantId])
  @@index([memberId])
}
```

Add inverse relations:
- `Tenant`: `notifications NotificationLog[]`
- `User`: `notifications NotificationLog[] @relation("MemberNotifications")`
- `Subscription`: `notifications NotificationLog[]`

- [ ] **Step 2: Migrate**

```bash
MIGRATION_DIR=prisma/migrations/$(date -u +%Y%m%d%H%M%S)_add_notification_log && mkdir -p $MIGRATION_DIR
npx dotenv -e .env.local -- npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > $MIGRATION_DIR/migration.sql
npx dotenv -e .env.local -- npx prisma migrate deploy
DATABASE_URL="postgresql://admin@localhost:5432/gym_management_test?schema=public" npx prisma migrate deploy
npx dotenv -e .env.local -- npx prisma generate
```

- [ ] **Step 3: Reset helper**

In `tests/helpers/db.ts`, add at top of `resetDb`:
```typescript
await testPrisma.notificationLog.deleteMany();
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(db): add NotificationLog model"
```

---

## Task 2: WhatsApp wrapper + CSV helper

**Files:** Create `src/lib/whatsapp.ts`, `src/lib/csv.ts`, `tests/lib/csv.test.ts`. Env vars.

- [ ] **Step 1: Env**

Append to `.env.example` and `.env.local`:
```
WHATSAPP_PHONE_ID=""
WHATSAPP_TOKEN=""
```

- [ ] **Step 2: WhatsApp wrapper**

`src/lib/whatsapp.ts`:
```typescript
export interface WhatsAppMessage {
  to: string;
  body: string;
}

export async function sendWhatsApp(msg: WhatsAppMessage): Promise<void> {
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const token = process.env.WHATSAPP_TOKEN;

  if (!phoneId || !token) {
    console.log("\n📱 WHATSAPP (dev fallback, WHATSAPP_TOKEN not set):");
    console.log(`  To:   ${msg.to}`);
    console.log(`  Body: ${msg.body}\n`);
    return;
  }

  const url = `https://graph.facebook.com/v18.0/${phoneId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: msg.to,
      type: "text",
      text: { body: msg.body },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`WhatsApp send failed: ${res.status} ${t}`);
  }
}
```

- [ ] **Step 3: CSV helper TDD**

`tests/lib/csv.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("renders header + rows", () => {
    const csv = toCsv([{ a: 1, b: "hi" }, { a: 2, b: "yo" }], ["a", "b"]);
    expect(csv).toBe("a,b\n1,hi\n2,yo");
  });
  it("escapes commas in values", () => {
    const csv = toCsv([{ a: "x,y" }], ["a"]);
    expect(csv).toBe(`a\n"x,y"`);
  });
  it("escapes double quotes by doubling", () => {
    const csv = toCsv([{ a: `he said "hi"` }], ["a"]);
    expect(csv).toBe(`a\n"he said ""hi"""`);
  });
  it("handles null/undefined as empty", () => {
    const csv = toCsv([{ a: null, b: undefined }], ["a", "b"]);
    expect(csv).toBe("a,b\n,");
  });
  it("formats Date as ISO", () => {
    const d = new Date("2026-05-25T10:00:00Z");
    const csv = toCsv([{ a: d }], ["a"]);
    expect(csv).toBe("a\n2026-05-25T10:00:00.000Z");
  });
});
```

`src/lib/csv.ts`:
```typescript
export function toCsv<T extends Record<string, unknown>>(rows: T[], columns: (keyof T)[]): string {
  const header = columns.join(",");
  const lines = rows.map((row) => columns.map((c) => escape(row[c])).join(","));
  return [header, ...lines].join("\n");
}

function escape(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s: string;
  if (v instanceof Date) s = v.toISOString();
  else s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
```

- [ ] **Step 4: Test + commit**

```bash
npm test -- tests/lib/csv.test.ts
git add -A && git commit -m "feat: add WhatsApp wrapper + CSV helper with tests"
```

---

## Task 3: Notifications server action TDD

**Files:** Create `src/lib/server-actions/notifications.ts`, `tests/lib/server-actions/notifications.test.ts`.

- [ ] **Step 1: Failing tests**

`tests/lib/server-actions/notifications.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { testPrisma, resetDb } from "../../helpers/db";
import { sendExpirationNotifications } from "@/lib/server-actions/notifications";
import { Role, SubscriptionStatus, TenantStatus, UserStatus, NotificationType, NotificationChannel } from "@prisma/client";

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(),
  buildActivationEmail: vi.fn(),
  buildRejectionEmail: vi.fn(),
}));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsApp: vi.fn(),
}));

async function seedMemberSub(daysToExpire: number) {
  const tenant = await testPrisma.tenant.create({
    data: { name: "T", slug: `t${Date.now()}${Math.random()}`, ownerEmail: "o@x.com", ownerPhone: "1", city: "Dakar", status: TenantStatus.ACTIVE },
  });
  const gym = await testPrisma.gym.create({
    data: { tenantId: tenant.id, name: "G", address: "a", city: "Dakar", phone: "1", latitude: 14.7, longitude: -17.4 },
  });
  const member = await testPrisma.user.create({
    data: {
      name: "M", email: `m${Date.now()}${Math.random()}@x.com`, passwordHash: "x",
      phone: "+221771111111", role: Role.MEMBER, status: UserStatus.ACTIVE, tenantId: tenant.id,
    },
  });
  const plan = await testPrisma.plan.create({
    data: { tenantId: tenant.id, gymId: gym.id, name: "M", durationDays: 30, price: 1000, currency: "XOF" },
  });
  const end = new Date();
  end.setHours(23, 59, 59, 0);
  end.setDate(end.getDate() + daysToExpire);
  const sub = await testPrisma.subscription.create({
    data: {
      tenantId: tenant.id, memberId: member.id, planId: plan.id,
      startDate: new Date(), endDate: end, status: SubscriptionStatus.ACTIVE,
    },
  });
  return { tenant, gym, member, sub };
}

describe("sendExpirationNotifications", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("sends J-7 notif to sub ending in ~7 days", async () => {
    const { sub } = await seedMemberSub(7);
    const r = await sendExpirationNotifications({ prisma: testPrisma });
    expect(r.sent).toBeGreaterThanOrEqual(2); // email + whatsapp
    const logs = await testPrisma.notificationLog.findMany({ where: { subscriptionId: sub.id } });
    expect(logs.some((l) => l.type === NotificationType.EXPIRATION_J7)).toBe(true);
  });

  it("sends J-3 notif to sub ending in ~3 days", async () => {
    await seedMemberSub(3);
    const r = await sendExpirationNotifications({ prisma: testPrisma });
    expect(r.sent).toBeGreaterThan(0);
    const logs = await testPrisma.notificationLog.findMany();
    expect(logs.some((l) => l.type === NotificationType.EXPIRATION_J3)).toBe(true);
  });

  it("sends J-0 notif to sub ending today", async () => {
    await seedMemberSub(0);
    const r = await sendExpirationNotifications({ prisma: testPrisma });
    expect(r.sent).toBeGreaterThan(0);
    const logs = await testPrisma.notificationLog.findMany();
    expect(logs.some((l) => l.type === NotificationType.EXPIRATION_J0)).toBe(true);
  });

  it("skips already-notified (anti-spam unique)", async () => {
    const { sub } = await seedMemberSub(7);
    await sendExpirationNotifications({ prisma: testPrisma });
    const before = await testPrisma.notificationLog.count();
    await sendExpirationNotifications({ prisma: testPrisma });
    const after = await testPrisma.notificationLog.count();
    expect(after).toBe(before);
  });

  it("skips non-ACTIVE subs", async () => {
    const { sub } = await seedMemberSub(7);
    await testPrisma.subscription.update({ where: { id: sub.id }, data: { status: SubscriptionStatus.CANCELLED } });
    const r = await sendExpirationNotifications({ prisma: testPrisma });
    expect(r.sent).toBe(0);
  });

  it("skips when member has no phone (WhatsApp only)", async () => {
    const { member } = await seedMemberSub(7);
    await testPrisma.user.update({ where: { id: member.id }, data: { phone: null } });
    await sendExpirationNotifications({ prisma: testPrisma });
    const logs = await testPrisma.notificationLog.findMany();
    const channels = logs.map((l) => l.channel);
    expect(channels).toContain(NotificationChannel.EMAIL);
    expect(channels).not.toContain(NotificationChannel.WHATSAPP);
  });
});
```

- [ ] **Step 2: Implement**

`src/lib/server-actions/notifications.ts`:
```typescript
import { PrismaClient, NotificationType, NotificationChannel, SubscriptionStatus, Prisma } from "@prisma/client";
import { sendEmail } from "@/lib/email";
import { sendWhatsApp } from "@/lib/whatsapp";

interface SubWithMember {
  id: string;
  tenantId: string;
  endDate: Date;
  member: { id: string; name: string; email: string; phone: string | null };
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

async function findSubsExpiringInDays(prisma: PrismaClient, days: number): Promise<SubWithMember[]> {
  const target = new Date();
  target.setDate(target.getDate() + days);
  return prisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.ACTIVE,
      endDate: { gte: startOfDay(target), lte: endOfDay(target) },
    },
    select: {
      id: true,
      tenantId: true,
      endDate: true,
      member: { select: { id: true, name: true, email: true, phone: true } },
    },
  });
}

function buildText(type: NotificationType, name: string, endDate: Date): string {
  const dateStr = endDate.toLocaleDateString("fr-FR");
  if (type === NotificationType.EXPIRATION_J7) return `Bonjour ${name}, votre abonnement expire le ${dateStr} (dans 7 jours). Pensez à renouveler.`;
  if (type === NotificationType.EXPIRATION_J3) return `Bonjour ${name}, votre abonnement expire dans 3 jours (${dateStr}). Renouvelez vite.`;
  return `Bonjour ${name}, votre abonnement expire AUJOURD'HUI (${dateStr}). Renouvelez pour continuer à accéder à la salle.`;
}

async function tryLogged(
  prisma: PrismaClient, tenantId: string, memberId: string, subscriptionId: string,
  type: NotificationType, channel: NotificationChannel, action: () => Promise<void>
): Promise<boolean> {
  try {
    await prisma.notificationLog.create({
      data: { tenantId, memberId, subscriptionId, type, channel, success: true },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    throw e;
  }
  try {
    await action();
  } catch (err) {
    await prisma.notificationLog.update({
      where: { subscriptionId_type_channel: { subscriptionId, type, channel } },
      data: { success: false, errorMessage: err instanceof Error ? err.message : String(err) },
    });
  }
  return true;
}

export async function sendExpirationNotifications(input: { prisma: PrismaClient }): Promise<{ sent: number }> {
  const tiers: Array<{ days: number; type: NotificationType }> = [
    { days: 7, type: NotificationType.EXPIRATION_J7 },
    { days: 3, type: NotificationType.EXPIRATION_J3 },
    { days: 0, type: NotificationType.EXPIRATION_J0 },
  ];

  let sent = 0;
  for (const t of tiers) {
    const subs = await findSubsExpiringInDays(input.prisma, t.days);
    for (const s of subs) {
      const text = buildText(t.type, s.member.name, s.endDate);

      const emailSent = await tryLogged(
        input.prisma, s.tenantId, s.member.id, s.id, t.type, NotificationChannel.EMAIL,
        () => sendEmail({ to: s.member.email, subject: "Expiration de votre abonnement", text, html: `<p>${text}</p>` }),
      );
      if (emailSent) sent++;

      if (s.member.phone) {
        const waSent = await tryLogged(
          input.prisma, s.tenantId, s.member.id, s.id, t.type, NotificationChannel.WHATSAPP,
          () => sendWhatsApp({ to: s.member.phone!, body: text }),
        );
        if (waSent) sent++;
      }
    }
  }
  return { sent };
}
```

- [ ] **Step 3: Test + commit**

```bash
npm test -- tests/lib/server-actions/notifications.test.ts
git add -A && git commit -m "feat: add expiration notifications server action with tests"
```

---

## Task 4: Cron route + Reports server action TDD

**Files:** Create `src/app/api/cron/expiration-notifications/route.ts`, `src/lib/server-actions/reports.ts`, `tests/lib/server-actions/reports.test.ts`.

- [ ] **Step 1: Cron route**

`src/app/api/cron/expiration-notifications/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendExpirationNotifications } from "@/lib/server-actions/notifications";

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const r = await sendExpirationNotifications({ prisma });
  return NextResponse.json({ ok: true, ...r });
}
```

- [ ] **Step 2: Reports failing tests**

`tests/lib/server-actions/reports.test.ts`:
```typescript
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
    // Add 2nd gym under same tenant
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
```

- [ ] **Step 3: Implement**

`src/lib/server-actions/reports.ts`:
```typescript
import { PrismaClient, SubscriptionStatus, CheckInStatus } from "@prisma/client";

function monthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

export interface ManagerReport {
  revenueXof: number;
  paymentsCount: number;
  checkInsCount: number;
  activeSubscriptions: number;
  newMembers: number;
}

export async function getManagerReport(input: {
  tenantId: string;
  gymId: string;
  year: number;
  month: number;
  prisma: PrismaClient;
}): Promise<ManagerReport> {
  const { start, end } = monthRange(input.year, input.month);

  const [payments, checkInsCount, activeSubscriptions, newMembers] = await Promise.all([
    input.prisma.payment.aggregate({
      where: { tenantId: input.tenantId, gymId: input.gymId, paidAt: { gte: start, lte: end } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    input.prisma.checkIn.count({
      where: { tenantId: input.tenantId, gymId: input.gymId, status: CheckInStatus.VALID, createdAt: { gte: start, lte: end } },
    }),
    input.prisma.subscription.count({
      where: { tenantId: input.tenantId, status: SubscriptionStatus.ACTIVE },
    }),
    input.prisma.user.count({
      where: { tenantId: input.tenantId, gymId: input.gymId, role: "MEMBER", createdAt: { gte: start, lte: end } },
    }),
  ]);

  return {
    revenueXof: payments._sum.amount ?? 0,
    paymentsCount: payments._count._all,
    checkInsCount,
    activeSubscriptions,
    newMembers,
  };
}

export interface TenantReportGymRow {
  gymId: string;
  gymName: string;
  revenueXof: number;
  paymentsCount: number;
  checkInsCount: number;
  membersCount: number;
}

export interface TenantReport {
  revenueXof: number;
  paymentsCount: number;
  checkInsCount: number;
  membersCount: number;
  byGym: TenantReportGymRow[];
}

export async function getTenantReport(input: {
  tenantId: string;
  year: number;
  month: number;
  prisma: PrismaClient;
}): Promise<TenantReport> {
  const { start, end } = monthRange(input.year, input.month);

  const gyms = await input.prisma.gym.findMany({
    where: { tenantId: input.tenantId },
    select: { id: true, name: true },
  });

  const byGym: TenantReportGymRow[] = [];
  let totalRevenue = 0, totalPayments = 0, totalCheckIns = 0, totalMembers = 0;
  for (const g of gyms) {
    const [pay, checks, members] = await Promise.all([
      input.prisma.payment.aggregate({
        where: { tenantId: input.tenantId, gymId: g.id, paidAt: { gte: start, lte: end } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      input.prisma.checkIn.count({
        where: { tenantId: input.tenantId, gymId: g.id, status: CheckInStatus.VALID, createdAt: { gte: start, lte: end } },
      }),
      input.prisma.user.count({ where: { tenantId: input.tenantId, gymId: g.id, role: "MEMBER" } }),
    ]);
    const revenue = pay._sum.amount ?? 0;
    const payCount = pay._count._all;
    byGym.push({ gymId: g.id, gymName: g.name, revenueXof: revenue, paymentsCount: payCount, checkInsCount: checks, membersCount: members });
    totalRevenue += revenue;
    totalPayments += payCount;
    totalCheckIns += checks;
    totalMembers += members;
  }

  byGym.sort((a, b) => b.revenueXof - a.revenueXof);

  return {
    revenueXof: totalRevenue,
    paymentsCount: totalPayments,
    checkInsCount: totalCheckIns,
    membersCount: totalMembers,
    byGym,
  };
}
```

- [ ] **Step 4: Test + commit**

```bash
npm test -- tests/lib/server-actions/reports.test.ts
git add -A && git commit -m "feat: add reports server actions + expiration cron route"
```

---

## Task 5: CSV export API routes

**Files:** Create 3 CSV routes.

- [ ] **Step 1: Manager payments CSV**

`src/app/api/manager/reports/payments.csv/route.ts`:
```typescript
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.MANAGER || !ctx.gymId) return new Response("Forbidden", { status: 403 });
  const payments = await prisma.payment.findMany({
    where: { tenantId: ctx.tenantId!, gymId: ctx.gymId },
    orderBy: { paidAt: "desc" },
    include: { member: true },
  });
  const rows = payments.map((p) => ({
    paidAt: p.paidAt,
    memberName: p.member.name,
    memberEmail: p.member.email,
    method: p.method,
    amountXof: p.amount,
    reference: p.reference ?? "",
  }));
  const csv = toCsv(rows, ["paidAt", "memberName", "memberEmail", "method", "amountXof", "reference"]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="paiements-${ctx.gymId}.csv"`,
    },
  });
}
```

- [ ] **Step 2: Manager check-ins CSV**

`src/app/api/manager/reports/checkins.csv/route.ts`:
```typescript
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.MANAGER || !ctx.gymId) return new Response("Forbidden", { status: 403 });
  const checks = await prisma.checkIn.findMany({
    where: { tenantId: ctx.tenantId!, gymId: ctx.gymId },
    orderBy: { createdAt: "desc" },
    take: 5000,
    include: { member: true },
  });
  const rows = checks.map((c) => ({
    createdAt: c.createdAt,
    memberName: c.member.name,
    status: c.status,
    source: c.source,
  }));
  const csv = toCsv(rows, ["createdAt", "memberName", "status", "source"]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="checkins-${ctx.gymId}.csv"`,
    },
  });
}
```

- [ ] **Step 3: Admin tenant CSV**

`src/app/api/admin/reports/by-gym.csv/route.ts`:
```typescript
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTenantReport } from "@/lib/server-actions/reports";
import { toCsv } from "@/lib/csv";

export async function GET(req: Request) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.TENANT_ADMIN || !ctx.tenantId) return new Response("Forbidden", { status: 403 });
  const url = new URL(req.url);
  const now = new Date();
  const year = Number(url.searchParams.get("year") ?? now.getFullYear());
  const month = Number(url.searchParams.get("month") ?? now.getMonth() + 1);
  const report = await getTenantReport({ tenantId: ctx.tenantId, year, month, prisma });
  const csv = toCsv(report.byGym, ["gymName", "revenueXof", "paymentsCount", "checkInsCount", "membersCount"]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rapport-${year}-${String(month).padStart(2, "0")}.csv"`,
    },
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add CSV export API routes (payments, checkins, by-gym)"
```

---

## Task 6: UI pages

**Files:** Create `src/app/manager/reports/page.tsx`, `src/app/admin/reports/page.tsx`. Update navs.

- [ ] **Step 1: Manager reports**

`src/app/manager/reports/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getManagerReport } from "@/lib/server-actions/reports";

export const dynamic = "force-dynamic";

export default async function ManagerReportsPage({ searchParams }: { searchParams: { year?: string; month?: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.MANAGER || !ctx.gymId || !ctx.tenantId) redirect("/login");

  const now = new Date();
  const year = Number(searchParams.year ?? now.getFullYear());
  const month = Number(searchParams.month ?? now.getMonth() + 1);

  const report = await getManagerReport({ tenantId: ctx.tenantId, gymId: ctx.gymId, year, month, prisma });
  const monthName = new Date(year, month - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Rapports — {monthName}</h1>
        <div className="flex gap-2">
          <a href="/api/manager/reports/payments.csv" className="px-3 py-2 text-sm rounded bg-slate-800 hover:bg-slate-700">⬇ Paiements CSV</a>
          <a href="/api/manager/reports/checkins.csv" className="px-3 py-2 text-sm rounded bg-slate-800 hover:bg-slate-700">⬇ Check-ins CSV</a>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Stat label="Revenus" value={`${report.revenueXof.toLocaleString("fr-FR")} XOF`} color="text-green-400" />
        <Stat label="Paiements" value={report.paymentsCount} color="text-slate-100" />
        <Stat label="Présences" value={report.checkInsCount} color="text-cyan-400" />
        <Stat label="Abonnements actifs" value={report.activeSubscriptions} color="text-blue-400" />
        <Stat label="Nouveaux membres" value={report.newMembers} color="text-amber-400" />
      </div>

      <MonthPicker year={year} month={month} basePath="/manager/reports" />
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded p-4">
      <div className="text-xs uppercase text-slate-400">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}

function MonthPicker({ year, month, basePath }: { year: number; month: number; basePath: string }) {
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  return (
    <div className="flex items-center gap-3 text-sm text-slate-400">
      <a href={`${basePath}?year=${prev.y}&month=${prev.m}`} className="hover:text-slate-200">← Mois précédent</a>
      <span>·</span>
      <a href={basePath} className="hover:text-slate-200">Aujourd&apos;hui</a>
      <span>·</span>
      <a href={`${basePath}?year=${next.y}&month=${next.m}`} className="hover:text-slate-200">Mois suivant →</a>
    </div>
  );
}
```

- [ ] **Step 2: Admin reports**

`src/app/admin/reports/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTenantReport } from "@/lib/server-actions/reports";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage({ searchParams }: { searchParams: { year?: string; month?: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.TENANT_ADMIN || !ctx.tenantId) redirect("/login");

  const now = new Date();
  const year = Number(searchParams.year ?? now.getFullYear());
  const month = Number(searchParams.month ?? now.getMonth() + 1);

  const report = await getTenantReport({ tenantId: ctx.tenantId, year, month, prisma });
  const monthName = new Date(year, month - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Rapports organisation — {monthName}</h1>
        <a href={`/api/admin/reports/by-gym.csv?year=${year}&month=${month}`} className="px-3 py-2 text-sm rounded bg-slate-800 hover:bg-slate-700">⬇ CSV par salle</a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded p-4"><div className="text-xs uppercase text-slate-400">Revenus</div><div className="text-2xl font-bold mt-1 text-green-400">{report.revenueXof.toLocaleString("fr-FR")} XOF</div></div>
        <div className="bg-slate-900 border border-slate-800 rounded p-4"><div className="text-xs uppercase text-slate-400">Paiements</div><div className="text-2xl font-bold mt-1 text-slate-100">{report.paymentsCount}</div></div>
        <div className="bg-slate-900 border border-slate-800 rounded p-4"><div className="text-xs uppercase text-slate-400">Présences</div><div className="text-2xl font-bold mt-1 text-cyan-400">{report.checkInsCount}</div></div>
        <div className="bg-slate-900 border border-slate-800 rounded p-4"><div className="text-xs uppercase text-slate-400">Membres</div><div className="text-2xl font-bold mt-1 text-blue-400">{report.membersCount}</div></div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-400 border-b border-slate-800">
            <tr><th className="px-4 py-3 text-left">Salle</th><th className="px-4 py-3 text-right">Revenus</th><th className="px-4 py-3 text-right">Paiements</th><th className="px-4 py-3 text-right">Présences</th><th className="px-4 py-3 text-right">Membres</th></tr>
          </thead>
          <tbody>
            {report.byGym.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Aucune salle</td></tr>}
            {report.byGym.map((g) => (
              <tr key={g.gymId} className="border-b border-slate-800 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-100">{g.gymName}</td>
                <td className="px-4 py-3 text-right text-green-400">{g.revenueXof.toLocaleString("fr-FR")}</td>
                <td className="px-4 py-3 text-right text-slate-300">{g.paymentsCount}</td>
                <td className="px-4 py-3 text-right text-cyan-400">{g.checkInsCount}</td>
                <td className="px-4 py-3 text-right text-blue-400">{g.membersCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Nav links**

In `src/components/manager/nav.tsx` add after "Check-ins live":
```tsx
<Link href="/manager/reports" className="text-sm text-slate-400 hover:text-slate-200">Rapports</Link>
```

In `src/components/admin/nav.tsx` add after "Facturation":
```tsx
<Link href="/admin/reports" className="text-sm text-slate-400 hover:text-slate-200">Rapports</Link>
```

- [ ] **Step 4: Build + commit**

```bash
npm run build
git add -A && git commit -m "feat: add /manager/reports + /admin/reports pages with CSV export"
```

---

## Task 7: End-to-end verification

- [ ] **Step 1: All tests + build**

```bash
npm test
npm run typecheck
npm run build
```
Expected: all green, +~17 new tests (csv 5 + notifications 6 + reports 4 + margin) → 128 total.

- [ ] **Step 2: Final commit**

```bash
git add -A && git status && git commit --allow-empty -m "chore: notifications + reports milestone (Plan 7)"
```

---

## Done criteria
- New tests pass
- `npm run build` succeeds
- `/manager/reports` + `/admin/reports` render stats + CSV download works
- Cron `/api/cron/expiration-notifications` triggers email + WhatsApp (dev fallback console)
- Anti-spam : same sub never gets duplicate notif of same type
