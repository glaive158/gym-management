# QR Check-in + Realtime + Anti-fraud Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Members scan QR at gym entrance, system validates subscription + geofence, manager dashboard updates in real-time via Pusher, manual fallback for offline cases.

**Architecture:** Public `/checkin` page captures geoloc + posts to `/api/checkin`. Server validates (tenant match, geofence 100m, subscription, anti-dup), inserts `CheckIn`, triggers Pusher event on `private-gym-{gymId}`. Manager `/manager/checkin-live` page subscribes via Pusher client, renders live feed with member photos.

**Tech Stack:** Next.js 14 Server Components, Prisma 6, Pusher (server + client), Vitest, Tailwind.

**Prerequisite:** Plans 1–4 merged on `main`. Branch `feat/qr-checkin`.

---

## File Structure

```
prisma/
  schema.prisma                                # +CheckIn model + CheckInStatus enum
  migrations/...                               # add_checkin_model
src/
  lib/
    geo.ts                                     # haversineMeters
    pusher-server.ts                           # singleton + pusherTrigger (no-op si env absent)
    pusher-client.ts                           # subscribeToGym
    server-actions/
      checkin.ts                               # performCheckIn, manualCheckIn, listRecentCheckIns
    prisma-tenant.ts                           # +"CheckIn"
  app/
    checkin/
      page.tsx                                 # server: auth gate
      checkin-client.tsx                       # client: geoloc + POST + UI
    api/
      checkin/route.ts                         # POST MEMBER
      manager/checkin/route.ts                 # POST MANAGER manual
      pusher/auth/route.ts                     # private channel auth
    manager/
      checkin-live/
        page.tsx                               # server: initial 50 fetch
        live-feed.tsx                          # client: Pusher subscribe + list
      page.tsx                                 # +"Présences aujourd'hui" stat
  components/
    manager/
      nav.tsx                                  # +link "Check-ins live"
      checkin-card.tsx                         # photo + name + badge
      manual-checkin.tsx                       # modal search + submit
tests/
  helpers/db.ts                                # +checkIn.deleteMany
  lib/
    geo.test.ts                                # haversine tests
    server-actions/checkin.test.ts             # ~12 tests
```

---

## Task 1: Schema CheckIn + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<ts>_add_checkin/migration.sql`

- [ ] **Step 1: Add enum + model**

Append to `prisma/schema.prisma`:
```prisma
enum CheckInStatus {
  VALID
  EXPIRED
  GEO_REJECTED
  DUPLICATE
  NO_SUBSCRIPTION
}

model CheckIn {
  id             String         @id @default(cuid())
  tenantId       String
  gymId          String
  memberId       String
  subscriptionId String?
  status         CheckInStatus
  latitude       Float?
  longitude      Float?
  distanceMeters Int?
  source         String         @default("QR")
  createdAt      DateTime       @default(now())

  tenant       Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  gym          Gym           @relation(fields: [gymId], references: [id], onDelete: Cascade)
  member       User          @relation("MemberCheckIns", fields: [memberId], references: [id], onDelete: Cascade)
  subscription Subscription? @relation(fields: [subscriptionId], references: [id], onDelete: SetNull)

  @@index([tenantId])
  @@index([gymId, createdAt])
  @@index([memberId, createdAt])
}
```

Add inverse relations:
- `Tenant`: `checkIns CheckIn[]`
- `Gym`: `checkIns CheckIn[]`
- `User`: `checkIns CheckIn[] @relation("MemberCheckIns")`
- `Subscription`: `checkIns CheckIn[]`

- [ ] **Step 2: Generate + apply migration**

```bash
MIGRATION_DIR=prisma/migrations/$(date -u +%Y%m%d%H%M%S)_add_checkin && mkdir -p $MIGRATION_DIR
npx dotenv -e .env.local -- npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > $MIGRATION_DIR/migration.sql
npx dotenv -e .env.local -- npx prisma migrate deploy
DATABASE_URL="postgresql://admin@localhost:5432/gym_management_test?schema=public" npx prisma migrate deploy
npx dotenv -e .env.local -- npx prisma generate
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(db): add CheckIn model + CheckInStatus enum"
```

---

## Task 2: Geo helper TDD

**Files:** Create `tests/lib/geo.test.ts`, `src/lib/geo.ts`

- [ ] **Step 1: Failing test**

`tests/lib/geo.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { haversineMeters } from "@/lib/geo";

describe("haversineMeters", () => {
  it("returns 0 for identical coords", () => {
    expect(haversineMeters(14.6928, -17.4467, 14.6928, -17.4467)).toBe(0);
  });
  it("returns ~111000m for 1° lat diff at equator", () => {
    const d = haversineMeters(0, 0, 1, 0);
    expect(d).toBeGreaterThan(110000);
    expect(d).toBeLessThan(112000);
  });
  it("returns ~95m for small Dakar offset", () => {
    const d = haversineMeters(14.6928, -17.4467, 14.6937, -17.4467);
    expect(d).toBeGreaterThan(80);
    expect(d).toBeLessThan(120);
  });
  it("symmetric A→B === B→A", () => {
    expect(haversineMeters(14.7, -17.4, 14.8, -17.5))
      .toBe(haversineMeters(14.8, -17.5, 14.7, -17.4));
  });
});
```

- [ ] **Step 2: Implement**

`src/lib/geo.ts`:
```typescript
const EARTH_RADIUS_M = 6371000;

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_M * c);
}
```

- [ ] **Step 3: Test + commit**

```bash
npm test -- tests/lib/geo.test.ts
git add -A && git commit -m "feat: add haversineMeters geo helper with tests"
```

---

## Task 3: Pusher server + client wrappers

**Files:** Create `src/lib/pusher-server.ts`, `src/lib/pusher-client.ts`, modify `.env.example`, `.env.local`

- [ ] **Step 1: Install pusher**

```bash
npm install pusher pusher-js
```

- [ ] **Step 2: Env vars**

Append to `.env.example` and `.env.local`:
```
PUSHER_APP_ID=""
PUSHER_KEY=""
PUSHER_SECRET=""
PUSHER_CLUSTER="eu"
NEXT_PUBLIC_PUSHER_KEY=""
NEXT_PUBLIC_PUSHER_CLUSTER="eu"
```

- [ ] **Step 3: Server singleton**

`src/lib/pusher-server.ts`:
```typescript
import Pusher from "pusher";

let pusher: Pusher | null = null;

function getPusher(): Pusher | null {
  if (pusher) return pusher;
  const { PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER } = process.env;
  if (!PUSHER_APP_ID || !PUSHER_KEY || !PUSHER_SECRET || !PUSHER_CLUSTER) return null;
  pusher = new Pusher({
    appId: PUSHER_APP_ID,
    key: PUSHER_KEY,
    secret: PUSHER_SECRET,
    cluster: PUSHER_CLUSTER,
    useTLS: true,
  });
  return pusher;
}

export async function pusherTrigger(channel: string, event: string, data: unknown): Promise<void> {
  const p = getPusher();
  if (!p) {
    console.log(`[pusher noop] ${channel} ${event}`, JSON.stringify(data));
    return;
  }
  await p.trigger(channel, event, data);
}

export function pusherAuthorize(channel: string, socketId: string): { auth: string } | null {
  const p = getPusher();
  if (!p) return null;
  return p.authorizeChannel(socketId, channel);
}
```

- [ ] **Step 4: Client singleton**

`src/lib/pusher-client.ts`:
```typescript
"use client";
import PusherClient from "pusher-js";

let client: PusherClient | null = null;

function getClient(): PusherClient | null {
  if (client) return client;
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  if (!key || !cluster) return null;
  client = new PusherClient(key, { cluster, authEndpoint: "/api/pusher/auth" });
  return client;
}

export interface GymCheckInEvent {
  checkInId: string;
  memberId: string;
  memberName: string;
  memberAvatar: string | null;
  status: "VALID" | "EXPIRED" | "DUPLICATE" | "NO_SUBSCRIPTION";
  createdAt: string;
  expiresAt: string | null;
  source: "QR" | "MANUAL";
}

export function subscribeToGym(gymId: string, onEvent: (e: GymCheckInEvent) => void): () => void {
  const c = getClient();
  if (!c) return () => {};
  const channel = c.subscribe(`private-gym-${gymId}`);
  channel.bind("checkin", onEvent);
  return () => {
    channel.unbind("checkin", onEvent);
    c.unsubscribe(`private-gym-${gymId}`);
  };
}
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add Pusher server/client wrappers with no-op fallback"
```

---

## Task 4: Add CheckIn to TENANT_SCOPED + reset helper

**Files:** Modify `src/lib/prisma-tenant.ts`, `tests/helpers/db.ts`

- [ ] **Step 1: Extend isolation list**

In `src/lib/prisma-tenant.ts`, change line:
```typescript
const TENANT_SCOPED_MODELS = new Set(["Gym", "User", "Plan", "Subscription", "Payment", "CheckIn"]);
```

- [ ] **Step 2: Reset helper**

In `tests/helpers/db.ts`, add `checkIn.deleteMany()` first:
```typescript
export async function resetDb(): Promise<void> {
  await testPrisma.checkIn.deleteMany();
  await testPrisma.payment.deleteMany();
  await testPrisma.subscription.deleteMany();
  await testPrisma.plan.deleteMany();
  await testPrisma.user.deleteMany();
  await testPrisma.gym.deleteMany();
  await testPrisma.tenant.deleteMany();
}
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "chore: wire CheckIn into tenant isolation + test reset"
```

---

## Task 5: CheckIn server actions TDD

**Files:** Create `tests/lib/server-actions/checkin.test.ts`, `src/lib/server-actions/checkin.ts`

- [ ] **Step 1: Failing tests**

`tests/lib/server-actions/checkin.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { testPrisma, resetDb } from "../../helpers/db";
import { performCheckIn, manualCheckIn, listRecentCheckIns } from "@/lib/server-actions/checkin";
import { Role, SubscriptionStatus, TenantStatus, UserStatus, CheckInStatus } from "@prisma/client";

vi.mock("@/lib/pusher-server", () => ({
  pusherTrigger: vi.fn(),
}));

const DAKAR = { lat: 14.6928, lng: -17.4467 };
const FAR = { lat: 14.8, lng: -17.4467 }; // ~12km away

async function seedTenantGymMember(opts: { gymLat?: number; gymLng?: number } = {}) {
  const tenant = await testPrisma.tenant.create({
    data: { name: "T", slug: `t${Date.now()}${Math.random()}`, ownerEmail: "o@x.com", ownerPhone: "1", city: "Dakar", status: TenantStatus.ACTIVE },
  });
  const gym = await testPrisma.gym.create({
    data: { tenantId: tenant.id, name: "G", address: "a", city: "Dakar", phone: "1", latitude: opts.gymLat ?? DAKAR.lat, longitude: opts.gymLng ?? DAKAR.lng },
  });
  const member = await testPrisma.user.create({
    data: { name: "M", email: `m${Date.now()}${Math.random()}@x.com`, passwordHash: "x", avatar: "/a.jpg", role: Role.MEMBER, status: UserStatus.ACTIVE, tenantId: tenant.id },
  });
  return { tenant, gym, member };
}

async function seedActiveSub(tenantId: string, gymId: string, memberId: string) {
  const plan = await testPrisma.plan.create({
    data: { tenantId, gymId, name: "M", durationDays: 30, price: 1000, currency: "XOF" },
  });
  return testPrisma.subscription.create({
    data: {
      tenantId, memberId, planId: plan.id,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 86400000),
      status: SubscriptionStatus.ACTIVE,
    },
  });
}

describe("performCheckIn", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("VALID when sub active + geo within 100m", async () => {
    const { gym, member } = await seedTenantGymMember();
    await seedActiveSub(member.tenantId!, gym.id, member.id);
    const r = await performCheckIn({ memberId: member.id, qrToken: gym.qrToken, latitude: DAKAR.lat, longitude: DAKAR.lng, prisma: testPrisma });
    expect(r.status).toBe(CheckInStatus.VALID);
    const rows = await testPrisma.checkIn.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe(CheckInStatus.VALID);
  });

  it("GEO_REJECTED when >100m", async () => {
    const { gym, member } = await seedTenantGymMember();
    await seedActiveSub(member.tenantId!, gym.id, member.id);
    const r = await performCheckIn({ memberId: member.id, qrToken: gym.qrToken, latitude: FAR.lat, longitude: FAR.lng, prisma: testPrisma });
    expect(r.status).toBe(CheckInStatus.GEO_REJECTED);
    expect(r.distanceMeters).toBeGreaterThan(100);
  });

  it("NO_SUBSCRIPTION when no active sub", async () => {
    const { gym, member } = await seedTenantGymMember();
    const r = await performCheckIn({ memberId: member.id, qrToken: gym.qrToken, latitude: DAKAR.lat, longitude: DAKAR.lng, prisma: testPrisma });
    expect(r.status).toBe(CheckInStatus.NO_SUBSCRIPTION);
  });

  it("EXPIRED when sub end past", async () => {
    const { tenant, gym, member } = await seedTenantGymMember();
    const plan = await testPrisma.plan.create({ data: { tenantId: tenant.id, gymId: gym.id, name: "M", durationDays: 30, price: 1000, currency: "XOF" } });
    await testPrisma.subscription.create({
      data: { tenantId: tenant.id, memberId: member.id, planId: plan.id, startDate: new Date(Date.now() - 60 * 86400000), endDate: new Date(Date.now() - 86400000), status: SubscriptionStatus.EXPIRED },
    });
    const r = await performCheckIn({ memberId: member.id, qrToken: gym.qrToken, latitude: DAKAR.lat, longitude: DAKAR.lng, prisma: testPrisma });
    expect(r.status).toBe(CheckInStatus.EXPIRED);
  });

  it("DUPLICATE when already VALID today", async () => {
    const { gym, member } = await seedTenantGymMember();
    await seedActiveSub(member.tenantId!, gym.id, member.id);
    const r1 = await performCheckIn({ memberId: member.id, qrToken: gym.qrToken, latitude: DAKAR.lat, longitude: DAKAR.lng, prisma: testPrisma });
    expect(r1.status).toBe(CheckInStatus.VALID);
    const r2 = await performCheckIn({ memberId: member.id, qrToken: gym.qrToken, latitude: DAKAR.lat, longitude: DAKAR.lng, prisma: testPrisma });
    expect(r2.status).toBe(CheckInStatus.DUPLICATE);
  });

  it("WRONG_TENANT when member tenant differs from gym tenant", async () => {
    const a = await seedTenantGymMember();
    const b = await seedTenantGymMember();
    const r = await performCheckIn({ memberId: a.member.id, qrToken: b.gym.qrToken, latitude: DAKAR.lat, longitude: DAKAR.lng, prisma: testPrisma });
    expect(r.error).toBe("WRONG_TENANT");
  });

  it("INVALID_QR when qrToken unknown", async () => {
    const { member } = await seedTenantGymMember();
    const r = await performCheckIn({ memberId: member.id, qrToken: "nope", latitude: DAKAR.lat, longitude: DAKAR.lng, prisma: testPrisma });
    expect(r.error).toBe("INVALID_QR");
  });
});

describe("manualCheckIn", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("creates CheckIn with source=MANUAL and no geoloc", async () => {
    const { gym, member } = await seedTenantGymMember();
    await seedActiveSub(member.tenantId!, gym.id, member.id);
    const r = await manualCheckIn({ gymId: gym.id, memberId: member.id, prisma: testPrisma });
    expect(r.status).toBe(CheckInStatus.VALID);
    const row = await testPrisma.checkIn.findFirstOrThrow();
    expect(row.source).toBe("MANUAL");
    expect(row.latitude).toBeNull();
  });

  it("manual VALID still hits DUPLICATE rule", async () => {
    const { gym, member } = await seedTenantGymMember();
    await seedActiveSub(member.tenantId!, gym.id, member.id);
    await manualCheckIn({ gymId: gym.id, memberId: member.id, prisma: testPrisma });
    const r = await manualCheckIn({ gymId: gym.id, memberId: member.id, prisma: testPrisma });
    expect(r.status).toBe(CheckInStatus.DUPLICATE);
  });
});

describe("listRecentCheckIns", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("returns most recent first, limited", async () => {
    const { gym, member } = await seedTenantGymMember();
    await seedActiveSub(member.tenantId!, gym.id, member.id);
    await manualCheckIn({ gymId: gym.id, memberId: member.id, prisma: testPrisma });
    const list = await listRecentCheckIns({ gymId: gym.id, limit: 10, prisma: testPrisma });
    expect(list).toHaveLength(1);
    expect(list[0].member.name).toBe("M");
  });
});
```

- [ ] **Step 2: Implement**

`src/lib/server-actions/checkin.ts`:
```typescript
import { PrismaClient, CheckInStatus, SubscriptionStatus } from "@prisma/client";
import { haversineMeters } from "@/lib/geo";
import { pusherTrigger } from "@/lib/pusher-server";

const GEOFENCE_METERS = 100;

export interface PerformCheckInInput {
  memberId: string;
  qrToken: string;
  latitude: number;
  longitude: number;
  prisma: PrismaClient;
}

export interface CheckInResult {
  status?: CheckInStatus;
  error?: "INVALID_QR" | "WRONG_TENANT";
  memberName?: string;
  expiresAt?: Date | null;
  distanceMeters?: number;
}

async function startOfToday(): Promise<Date> {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function triggerLive(prisma: PrismaClient, checkInId: string): Promise<void> {
  const row = await prisma.checkIn.findUnique({
    where: { id: checkInId },
    include: { member: true, subscription: true },
  });
  if (!row) return;
  await pusherTrigger(`private-gym-${row.gymId}`, "checkin", {
    checkInId: row.id,
    memberId: row.memberId,
    memberName: row.member.name,
    memberAvatar: row.member.avatar,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.subscription?.endDate.toISOString() ?? null,
    source: row.source,
  });
}

export async function performCheckIn(input: PerformCheckInInput): Promise<CheckInResult> {
  const gym = await input.prisma.gym.findUnique({ where: { qrToken: input.qrToken } });
  if (!gym) return { error: "INVALID_QR" };

  const member = await input.prisma.user.findUnique({ where: { id: input.memberId } });
  if (!member || member.tenantId !== gym.tenantId) return { error: "WRONG_TENANT" };

  const distance = haversineMeters(member ? input.latitude : 0, input.longitude, gym.latitude, gym.longitude);

  if (distance > GEOFENCE_METERS) {
    const row = await input.prisma.checkIn.create({
      data: {
        tenantId: gym.tenantId, gymId: gym.id, memberId: member.id,
        status: CheckInStatus.GEO_REJECTED,
        latitude: input.latitude, longitude: input.longitude, distanceMeters: distance,
        source: "QR",
      },
    });
    return { status: row.status, distanceMeters: distance };
  }

  const today = await startOfToday();
  const dup = await input.prisma.checkIn.findFirst({
    where: { memberId: member.id, status: CheckInStatus.VALID, createdAt: { gte: today } },
  });
  if (dup) {
    const row = await input.prisma.checkIn.create({
      data: {
        tenantId: gym.tenantId, gymId: gym.id, memberId: member.id,
        status: CheckInStatus.DUPLICATE,
        latitude: input.latitude, longitude: input.longitude, distanceMeters: distance,
        source: "QR",
      },
    });
    await triggerLive(input.prisma, row.id);
    return { status: row.status, memberName: member.name };
  }

  const sub = await input.prisma.subscription.findFirst({
    where: { memberId: member.id, status: SubscriptionStatus.ACTIVE, endDate: { gte: new Date() } },
    orderBy: { endDate: "desc" },
  });

  let status: CheckInStatus;
  if (!sub) {
    const anySub = await input.prisma.subscription.findFirst({
      where: { memberId: member.id },
      orderBy: { endDate: "desc" },
    });
    status = anySub ? CheckInStatus.EXPIRED : CheckInStatus.NO_SUBSCRIPTION;
  } else {
    status = CheckInStatus.VALID;
  }

  const row = await input.prisma.checkIn.create({
    data: {
      tenantId: gym.tenantId, gymId: gym.id, memberId: member.id, subscriptionId: sub?.id,
      status,
      latitude: input.latitude, longitude: input.longitude, distanceMeters: distance,
      source: "QR",
    },
  });
  await triggerLive(input.prisma, row.id);
  return { status, memberName: member.name, expiresAt: sub?.endDate ?? null };
}

export async function manualCheckIn(input: { gymId: string; memberId: string; prisma: PrismaClient }): Promise<CheckInResult> {
  const gym = await input.prisma.gym.findUnique({ where: { id: input.gymId } });
  if (!gym) return { error: "INVALID_QR" };
  const member = await input.prisma.user.findUnique({ where: { id: input.memberId } });
  if (!member || member.tenantId !== gym.tenantId) return { error: "WRONG_TENANT" };

  const today = await startOfToday();
  const dup = await input.prisma.checkIn.findFirst({
    where: { memberId: member.id, status: CheckInStatus.VALID, createdAt: { gte: today } },
  });
  if (dup) {
    const row = await input.prisma.checkIn.create({
      data: { tenantId: gym.tenantId, gymId: gym.id, memberId: member.id, status: CheckInStatus.DUPLICATE, source: "MANUAL" },
    });
    await triggerLive(input.prisma, row.id);
    return { status: row.status, memberName: member.name };
  }

  const sub = await input.prisma.subscription.findFirst({
    where: { memberId: member.id, status: SubscriptionStatus.ACTIVE, endDate: { gte: new Date() } },
    orderBy: { endDate: "desc" },
  });
  let status: CheckInStatus;
  if (!sub) {
    const anySub = await input.prisma.subscription.findFirst({ where: { memberId: member.id }, orderBy: { endDate: "desc" } });
    status = anySub ? CheckInStatus.EXPIRED : CheckInStatus.NO_SUBSCRIPTION;
  } else {
    status = CheckInStatus.VALID;
  }

  const row = await input.prisma.checkIn.create({
    data: { tenantId: gym.tenantId, gymId: gym.id, memberId: member.id, subscriptionId: sub?.id, status, source: "MANUAL" },
  });
  await triggerLive(input.prisma, row.id);
  return { status, memberName: member.name, expiresAt: sub?.endDate ?? null };
}

export async function listRecentCheckIns(input: { gymId: string; limit: number; prisma: PrismaClient }) {
  return input.prisma.checkIn.findMany({
    where: { gymId: input.gymId },
    orderBy: { createdAt: "desc" },
    take: input.limit,
    include: { member: true, subscription: true },
  });
}
```

- [ ] **Step 3: Test + commit**

```bash
npm test -- tests/lib/server-actions/checkin.test.ts
git add -A && git commit -m "feat: add checkin server actions (perform/manual/list) with tests"
```

---

## Task 6: API routes (checkin, manager checkin, pusher auth)

**Files:** Create three route files.

- [ ] **Step 1: Member checkin POST**

`src/app/api/checkin/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { performCheckIn } from "@/lib/server-actions/checkin";

export async function POST(req: Request) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.MEMBER) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const lat = Number(body.latitude), lng = Number(body.longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return NextResponse.json({ error: "BAD_GEO" }, { status: 400 });
  const result = await performCheckIn({
    memberId: ctx.userId,
    qrToken: String(body.qrToken ?? ""),
    latitude: lat,
    longitude: lng,
    prisma,
  });
  return NextResponse.json(result);
}
```

- [ ] **Step 2: Manager manual POST**

`src/app/api/manager/checkin/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { manualCheckIn } from "@/lib/server-actions/checkin";

export async function POST(req: Request) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.MANAGER || !ctx.gymId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const result = await manualCheckIn({ gymId: ctx.gymId, memberId: String(body.memberId ?? ""), prisma });
  return NextResponse.json(result);
}
```

- [ ] **Step 3: Pusher auth**

`src/app/api/pusher/auth/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { pusherAuthorize } from "@/lib/pusher-server";

export async function POST(req: Request) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.MANAGER || !ctx.gymId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const form = await req.formData();
  const socketId = String(form.get("socket_id") ?? "");
  const channel = String(form.get("channel_name") ?? "");
  if (channel !== `private-gym-${ctx.gymId}`) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const auth = pusherAuthorize(channel, socketId);
  if (!auth) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  return NextResponse.json(auth);
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add checkin/manager-checkin/pusher-auth API routes"
```

---

## Task 7: /checkin page (member)

**Files:** Create `src/app/checkin/page.tsx`, `src/app/checkin/checkin-client.tsx`. Update middleware allowlist if needed (already public).

- [ ] **Step 1: Client component**

`src/app/checkin/checkin-client.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";

type Status = "VALID" | "EXPIRED" | "GEO_REJECTED" | "DUPLICATE" | "NO_SUBSCRIPTION";
type ErrorCode = "INVALID_QR" | "WRONG_TENANT" | "BAD_GEO" | "GEO_DENIED" | "NETWORK";

export function CheckinClient({ qrToken }: { qrToken: string }) {
  const [phase, setPhase] = useState<"locating" | "submitting" | "done">("locating");
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [memberName, setMemberName] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [distance, setDistance] = useState<number | null>(null);

  async function run() {
    setPhase("locating");
    setError(null);
    setStatus(null);
    if (!navigator.geolocation) { setError("GEO_DENIED"); setPhase("done"); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setPhase("submitting");
        try {
          const res = await fetch("/api/checkin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ qrToken, latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          });
          const j = await res.json();
          if (j.error) setError(j.error);
          else {
            setStatus(j.status);
            setMemberName(j.memberName ?? null);
            setExpiresAt(j.expiresAt ?? null);
            setDistance(j.distanceMeters ?? null);
          }
        } catch {
          setError("NETWORK");
        }
        setPhase("done");
      },
      () => { setError("GEO_DENIED"); setPhase("done"); },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  useEffect(() => { run(); }, []);

  if (phase === "locating") return <Wrap>📍 Localisation en cours…</Wrap>;
  if (phase === "submitting") return <Wrap>⏳ Vérification…</Wrap>;

  if (error === "GEO_DENIED") return <Wrap kind="warn">Activez la localisation puis réessayez.<br /><Retry onClick={run} /></Wrap>;
  if (error === "NETWORK") return <Wrap kind="warn">Erreur réseau.<br /><Retry onClick={run} /></Wrap>;
  if (error === "INVALID_QR") return <Wrap kind="error">QR invalide. Demandez à l&apos;accueil.</Wrap>;
  if (error === "WRONG_TENANT") return <Wrap kind="error">Ce QR n&apos;est pas pour votre salle.</Wrap>;
  if (error === "BAD_GEO") return <Wrap kind="error">Position invalide.</Wrap>;

  if (status === "VALID") return <Wrap kind="ok">✅ Bienvenue {memberName}.<br />Valide jusqu&apos;au {expiresAt ? new Date(expiresAt).toLocaleDateString("fr-FR") : "—"}.</Wrap>;
  if (status === "DUPLICATE") return <Wrap kind="info">ℹ️ Déjà enregistré aujourd&apos;hui.</Wrap>;
  if (status === "EXPIRED") return <Wrap kind="error">⛔ Abonnement expiré le {expiresAt ? new Date(expiresAt).toLocaleDateString("fr-FR") : "—"}.<br />Contactez le gérant.</Wrap>;
  if (status === "NO_SUBSCRIPTION") return <Wrap kind="error">⛔ Aucun abonnement actif. Contactez le gérant.</Wrap>;
  if (status === "GEO_REJECTED") return <Wrap kind="warn">🚫 Vous êtes à {distance}m. Approchez de l&apos;entrée.<br /><Retry onClick={run} /></Wrap>;

  return null;
}

function Wrap({ children, kind }: { children: React.ReactNode; kind?: "ok" | "warn" | "error" | "info" }) {
  const c =
    kind === "ok" ? "bg-green-950 border-green-800 text-green-100"
    : kind === "warn" ? "bg-amber-950 border-amber-800 text-amber-100"
    : kind === "error" ? "bg-red-950 border-red-800 text-red-100"
    : kind === "info" ? "bg-blue-950 border-blue-800 text-blue-100"
    : "bg-slate-900 border-slate-800 text-slate-100";
  return <div className={`max-w-md mx-auto mt-12 p-6 rounded-lg border text-center text-lg ${c}`}>{children}</div>;
}

function Retry({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="mt-3 px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-base">Réessayer</button>;
}
```

- [ ] **Step 2: Server page**

`src/app/checkin/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { CheckinClient } from "./checkin-client";

export const dynamic = "force-dynamic";

export default async function CheckinPage({ searchParams }: { searchParams: { gym?: string } }) {
  const qr = searchParams.gym ?? "";
  if (!qr) {
    return <main className="min-h-screen bg-slate-950 text-slate-100 p-6"><div className="max-w-md mx-auto mt-12 text-center">QR manquant.</div></main>;
  }
  const ctx = await getCurrentAuthContext();
  if (!ctx) redirect(`/login?callbackUrl=${encodeURIComponent(`/checkin?gym=${qr}`)}`);
  if (ctx.role !== Role.MEMBER) {
    return <main className="min-h-screen bg-slate-950 text-slate-100 p-6"><div className="max-w-md mx-auto mt-12 text-center">Cette page est réservée aux membres.</div></main>;
  }
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <CheckinClient qrToken={qr} />
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add /checkin member page with geoloc + result UI"
```

---

## Task 8: Manager live feed page + components

**Files:** Create `src/app/manager/checkin-live/page.tsx`, `src/app/manager/checkin-live/live-feed.tsx`, `src/components/manager/checkin-card.tsx`, `src/components/manager/manual-checkin.tsx`. Update nav.

- [ ] **Step 1: Card component**

`src/components/manager/checkin-card.tsx`:
```tsx
import Image from "next/image";

const STATUS_STYLE: Record<string, string> = {
  VALID: "bg-green-950 border-green-800 text-green-100",
  EXPIRED: "bg-red-950 border-red-800 text-red-100",
  DUPLICATE: "bg-blue-950 border-blue-800 text-blue-100",
  NO_SUBSCRIPTION: "bg-red-950 border-red-800 text-red-100",
  GEO_REJECTED: "bg-amber-950 border-amber-800 text-amber-100",
};

const LABEL: Record<string, string> = {
  VALID: "À jour", EXPIRED: "Expiré", DUPLICATE: "Doublon",
  NO_SUBSCRIPTION: "Pas d'abonnement", GEO_REJECTED: "Hors zone",
};

export function CheckinCard({ avatar, name, status, time, source }: { avatar: string | null; name: string; status: string; time: string; source: string }) {
  return (
    <div className={`flex items-center gap-4 p-4 rounded-lg border ${STATUS_STYLE[status] ?? "bg-slate-900 border-slate-800"}`}>
      {avatar ? (
        <Image src={avatar} alt={name} width={64} height={64} className="rounded-full object-cover" unoptimized />
      ) : (
        <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center text-xl">{name[0]}</div>
      )}
      <div className="flex-1">
        <div className="font-semibold text-lg">{name}</div>
        <div className="text-xs opacity-75">{LABEL[status]} · {source} · {new Date(time).toLocaleTimeString("fr-FR")}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manual check-in modal**

`src/components/manager/manual-checkin.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ManualCheckin({ members }: { members: Array<{ id: string; name: string; email: string }> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = members.filter((m) =>
    m.name.toLowerCase().includes(q.toLowerCase()) || m.email.toLowerCase().includes(q.toLowerCase())
  ).slice(0, 20);

  async function submit(memberId: string) {
    setError(null);
    setLoading(true);
    const res = await fetch("/api/manager/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Erreur");
      return;
    }
    setOpen(false);
    setQ("");
    router.refresh();
  }

  if (!open) {
    return <button onClick={() => setOpen(true)} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-sm font-medium">+ Check-in manuel</button>;
  }
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 max-w-md w-full space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">Check-in manuel</h3>
          <button onClick={() => setOpen(false)} className="text-slate-400">✕</button>
        </div>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nom ou email…"
          className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-slate-100"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <ul className="max-h-72 overflow-y-auto divide-y divide-slate-800">
          {filtered.map((m) => (
            <li key={m.id}>
              <button disabled={loading} onClick={() => submit(m.id)} className="w-full text-left px-3 py-2 hover:bg-slate-800 disabled:opacity-50">
                <div className="font-medium">{m.name}</div>
                <div className="text-xs text-slate-400">{m.email}</div>
              </button>
            </li>
          ))}
          {filtered.length === 0 && <li className="px-3 py-2 text-slate-500 text-sm">Aucun résultat</li>}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Live feed**

`src/app/manager/checkin-live/live-feed.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { subscribeToGym, type GymCheckInEvent } from "@/lib/pusher-client";
import { CheckinCard } from "@/components/manager/checkin-card";

interface InitialItem {
  id: string;
  status: string;
  source: string;
  createdAt: string;
  member: { name: string; avatar: string | null };
}

export function LiveFeed({ gymId, initial }: { gymId: string; initial: InitialItem[] }) {
  const [items, setItems] = useState<InitialItem[]>(initial);

  useEffect(() => {
    const unsub = subscribeToGym(gymId, (e: GymCheckInEvent) => {
      setItems((prev) => [
        { id: e.checkInId, status: e.status, source: e.source, createdAt: e.createdAt, member: { name: e.memberName, avatar: e.memberAvatar } },
        ...prev,
      ].slice(0, 100));
    });
    return unsub;
  }, [gymId]);

  if (items.length === 0) return <p className="text-slate-500 text-sm">Aucun check-in pour le moment.</p>;
  return (
    <div className="space-y-3">
      {items.map((it) => (
        <CheckinCard key={it.id} avatar={it.member.avatar} name={it.member.name} status={it.status} time={it.createdAt} source={it.source} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Server page**

`src/app/manager/checkin-live/page.tsx`:
```tsx
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { listRecentCheckIns } from "@/lib/server-actions/checkin";
import { LiveFeed } from "./live-feed";
import { ManualCheckin } from "@/components/manager/manual-checkin";

export const dynamic = "force-dynamic";

export default async function CheckinLivePage() {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.MANAGER || !ctx.gymId) redirect("/login");

  const [recent, members] = await Promise.all([
    listRecentCheckIns({ gymId: ctx.gymId, limit: 50, prisma }),
    prisma.user.findMany({
      where: { gymId: ctx.gymId, role: Role.MEMBER, status: "ACTIVE" },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const initial = recent.map((r) => ({
    id: r.id, status: r.status, source: r.source, createdAt: r.createdAt.toISOString(),
    member: { name: r.member.name, avatar: r.member.avatar },
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Check-ins en direct</h1>
        <ManualCheckin members={members} />
      </div>
      <LiveFeed gymId={ctx.gymId} initial={initial} />
    </div>
  );
}
```

- [ ] **Step 5: Nav link**

In `src/components/manager/nav.tsx`, add a `Check-ins live` link to `/manager/checkin-live`.

- [ ] **Step 6: Build + commit**

```bash
npm run build
git add -A && git commit -m "feat: add /manager/checkin-live realtime feed + manual check-in modal"
```

---

## Task 9: Dashboard stat + members `gymId` defensive check

**Files:** Modify `src/app/manager/page.tsx`. Add "Présences aujourd'hui".

- [ ] **Step 1: Add today count**

In `src/app/manager/page.tsx`, add inside the parallel `Promise.all`:
```typescript
prisma.checkIn.count({
  where: { gymId: ctx.gymId, status: "VALID", createdAt: { gte: (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })() } },
}),
```

And add the corresponding stat card (e.g. blue "Présences aujourd'hui").

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add 'Présences aujourd'hui' stat on manager dashboard"
```

---

## Task 10: End-to-end verification

- [ ] **Step 1: All tests**

```bash
npm test
npm run typecheck
npm run build
```
Expected: all green, +~11 new tests (geo 4 + checkin 7).

- [ ] **Step 2: Manual smoke (optional, requires Pusher creds for live)**

Without Pusher keys: server logs `[pusher noop] private-gym-... checkin {...}` instead of pushing — UI still works (page just won't auto-update without refresh).

- [ ] **Step 3: Final commit**

```bash
git add -A && git status && git commit -m "chore: QR check-in milestone (Plan 5)" --allow-empty
```

---

## Done criteria
- New tests (geo + checkin) pass
- `npm run build` succeeds, no TS errors
- `/checkin?gym=<token>` works as MEMBER with geoloc
- `/manager/checkin-live` shows initial 50 + new check-ins via Pusher
- Manual check-in works from manager UI
