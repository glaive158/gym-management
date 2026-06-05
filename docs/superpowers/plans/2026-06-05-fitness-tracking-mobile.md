# Fitness Tracking — DB Persistence + Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist fitness tracking (profile, weights, sleep, sessions, weekly progress) to PostgreSQL, expose via dual-auth REST APIs, migrate web off localStorage, and add a complete fitness screen to the Android app.

**Architecture:** Four new Prisma models scoped to a member (tenant scoping done manually via `where` clauses, matching the existing `FitnessProgram` convention). Pure server-action functions wrap all DB access and are reused by both web and mobile through thin REST routes that try NextAuth first then fall back to JWT bearer. The web `useFitApp` hook keeps its public interface but swaps localStorage for API calls; the mobile app gets a mirror hook + screen.

**Tech Stack:** Next.js 14 (App Router), Prisma 6, PostgreSQL, vitest, React Native (Expo SDK 56), TypeScript.

---

## File Structure

**Backend (web repo `/Users/admin/gym-management`):**
- `prisma/schema.prisma` — add 4 models + User inverse relations
- `src/lib/server-actions/fitness-tracking.ts` — CREATE: all pure DB functions
- `src/app/api/me/fitness/data/route.ts` — CREATE: GET full FitAppData
- `src/app/api/me/fitness/profile/route.ts` — CREATE: POST upsertProfile
- `src/app/api/me/fitness/weights/route.ts` — CREATE: POST addWeightLog
- `src/app/api/me/fitness/sessions/route.ts` — CREATE: POST addWorkoutSession
- `src/app/api/me/fitness/day-progress/route.ts` — CREATE: POST toggleDayProgress
- `src/hooks/use-fit-app.ts` — MODIFY: localStorage → API
- `tests/helpers/db.ts` — MODIFY: cleanup new tables
- `tests/lib/server-actions/fitness-tracking.test.ts` — CREATE: tests

**Mobile (`/Users/admin/gym-management/mobile`):**
- `mobile/src/lib/fitness.ts` — CREATE: shared types + WEEKLY_SCHEDULE copy + API calls
- `mobile/src/hooks/useFitApp.ts` — CREATE: fetch-based hook
- `mobile/src/screens/FitnessScreen.tsx` — CREATE: 4-tab screen
- `mobile/src/navigation/AppNavigator.tsx` — MODIFY: add "Forme" tab

---

## Task 1: Prisma models + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `tests/helpers/db.ts`

- [ ] **Step 1: Add models to schema**

Append to `prisma/schema.prisma`:

```prisma
model FitnessProfile {
  id            String   @id @default(cuid())
  memberId      String   @unique
  tenantId      String
  startWeightKg Float
  goalWeightKg  Float
  durationWeeks Int
  startDate     DateTime
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  member        User     @relation("MemberFitnessProfile", fields: [memberId], references: [id], onDelete: Cascade)
  @@index([memberId])
  @@index([tenantId])
}

model FitnessWeightLog {
  id         String   @id @default(cuid())
  memberId   String
  tenantId   String
  date       DateTime
  weightKg   Float
  sleepHours Float?
  createdAt  DateTime @default(now())
  member     User     @relation("MemberFitnessWeights", fields: [memberId], references: [id], onDelete: Cascade)
  @@index([memberId, date])
}

model FitnessWorkoutSession {
  id          String   @id @default(cuid())
  memberId    String
  tenantId    String
  date        DateTime
  programId   String?
  programName String
  durationMin Int
  kind        String
  createdAt   DateTime @default(now())
  member      User     @relation("MemberFitnessSessions", fields: [memberId], references: [id], onDelete: Cascade)
  @@index([memberId, date])
}

model FitnessDayProgress {
  id        String  @id @default(cuid())
  memberId  String
  tenantId  String
  weekIndex Int
  dayIndex  Int
  done      Boolean @default(false)
  member    User    @relation("MemberFitnessProgress", fields: [memberId], references: [id], onDelete: Cascade)
  @@unique([memberId, weekIndex, dayIndex])
  @@index([memberId])
}
```

- [ ] **Step 2: Add inverse relations to User model**

In `prisma/schema.prisma`, find the `model User { ... }` block and add these lines alongside the existing `fitnessPrograms` relation field:

```prisma
  fitnessProfile          FitnessProfile?         @relation("MemberFitnessProfile")
  fitnessWeights          FitnessWeightLog[]      @relation("MemberFitnessWeights")
  fitnessSessions         FitnessWorkoutSession[] @relation("MemberFitnessSessions")
  fitnessProgress         FitnessDayProgress[]    @relation("MemberFitnessProgress")
```

- [ ] **Step 3: Create migration**

Run: `npm run db:migrate -- --name fitness_tracking`
Expected: migration generated + applied to dev DB, Prisma client regenerated.

- [ ] **Step 4: Apply migration to test DB**

Run: `DATABASE_URL="$DATABASE_URL_TEST" npx prisma migrate deploy`
Expected: "All migrations have been successfully applied."

- [ ] **Step 5: Update test cleanup helper**

In `tests/helpers/db.ts`, inside `resetDb()`, add these lines BEFORE `await testPrisma.user.deleteMany();`:

```typescript
  await testPrisma.fitnessDayProgress.deleteMany();
  await testPrisma.fitnessWorkoutSession.deleteMany();
  await testPrisma.fitnessWeightLog.deleteMany();
  await testPrisma.fitnessProfile.deleteMany();
```

- [ ] **Step 6: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors).

- [ ] **Step 7: Commit**

```bash
git add prisma/ tests/helpers/db.ts
git commit -m "feat(fitness): add tracking models (profile, weights, sessions, progress)"
```

---

## Task 2: Server actions — getFitnessData + upsertProfile

**Files:**
- Create: `src/lib/server-actions/fitness-tracking.ts`
- Test: `tests/lib/server-actions/fitness-tracking.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/lib/server-actions/fitness-tracking.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { testPrisma, resetDb } from "../../helpers/db";
import {
  getFitnessData,
  upsertProfile,
  addWeightLog,
  addWorkoutSession,
  toggleDayProgress,
} from "@/lib/server-actions/fitness-tracking";

async function seedMember() {
  const tenant = await testPrisma.tenant.create({
    data: { name: "T", slug: `t-${Math.random().toString(36).slice(2)}`, status: "ACTIVE" },
  });
  const gym = await testPrisma.gym.create({
    data: { tenantId: tenant.id, name: "G", address: "a", city: "Dakar", phone: "1", latitude: 14.6, longitude: -17.4 },
  });
  const member = await testPrisma.user.create({
    data: { name: "M", role: "MEMBER", tenantId: tenant.id, gymId: gym.id },
  });
  return { tenantId: tenant.id, gymId: gym.id, memberId: member.id };
}

describe("fitness-tracking", () => {
  beforeEach(async () => { await resetDb(); });

  it("upsertProfile creates durationWeeks*7 day-progress rows", async () => {
    const { tenantId, memberId } = await seedMember();
    const r = await upsertProfile({
      memberId, tenantId, startWeightKg: 80, goalWeightKg: 72,
      durationWeeks: 4, startDate: "2026-06-01T00:00:00.000Z", prisma: testPrisma,
    });
    expect(r.success).toBe(true);
    const count = await testPrisma.fitnessDayProgress.count({ where: { memberId } });
    expect(count).toBe(28);
  });

  it("getFitnessData returns empty shape when no profile", async () => {
    const { tenantId, memberId } = await seedMember();
    const r = await getFitnessData({ memberId, tenantId, prisma: testPrisma });
    expect(r.success).toBe(true);
    expect(r.data.profile).toBeNull();
    expect(r.data.weights).toEqual([]);
    expect(r.data.sessions).toEqual([]);
    expect(r.data.weekData).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- fitness-tracking`
Expected: FAIL — module `fitness-tracking` not found.

- [ ] **Step 3: Implement getFitnessData + upsertProfile**

Create `src/lib/server-actions/fitness-tracking.ts`:

```typescript
import type { PrismaClient } from "@prisma/client";
import { WEEKLY_SCHEDULE } from "@/lib/fitness-defaults";

type Tx = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export interface FitProfileDTO {
  startWeightKg: number;
  goalWeightKg: number;
  durationWeeks: number;
  startDate: string;
}
export interface WeekDayDTO { type: string; label: string; durationMin: number | null; done: boolean }
export interface WeightDTO { date: string; weightKg: number }
export interface SleepDTO { date: string; hours: number }
export interface SessionDTO { date: string; programId: string; programName: string; durationMin: number }
export interface FitDataDTO {
  profile: FitProfileDTO | null;
  weekData: WeekDayDTO[][];
  weights: WeightDTO[];
  sleeps: SleepDTO[];
  sessions: SessionDTO[];
}

function ok<T>(data: T) { return { success: true as const, data }; }
function err(error: string) { return { success: false as const, error }; }

export async function getFitnessData(args: {
  memberId: string; tenantId: string; prisma: PrismaClient;
}): Promise<{ success: true; data: FitDataDTO } | { success: false; error: string }> {
  const { memberId, tenantId, prisma } = args;
  const profile = await prisma.fitnessProfile.findFirst({ where: { memberId, tenantId } });
  const weightRows = await prisma.fitnessWeightLog.findMany({
    where: { memberId, tenantId }, orderBy: { date: "asc" },
  });
  const sessionRows = await prisma.fitnessWorkoutSession.findMany({
    where: { memberId, tenantId }, orderBy: { date: "desc" },
  });
  const progressRows = await prisma.fitnessDayProgress.findMany({
    where: { memberId, tenantId },
  });

  const weights: WeightDTO[] = weightRows.map((w) => ({ date: w.date.toISOString(), weightKg: w.weightKg }));
  const sleeps: SleepDTO[] = weightRows
    .filter((w) => w.sleepHours != null)
    .map((w) => ({ date: w.date.toISOString(), hours: w.sleepHours as number }));
  const sessions: SessionDTO[] = sessionRows.map((s) => ({
    date: s.date.toISOString(), programId: s.programId ?? s.kind, programName: s.programName, durationMin: s.durationMin,
  }));

  let weekData: WeekDayDTO[][] = [];
  if (profile) {
    const doneMap = new Map<string, boolean>();
    for (const p of progressRows) doneMap.set(`${p.weekIndex}-${p.dayIndex}`, p.done);
    weekData = Array.from({ length: profile.durationWeeks }, (_, wi) =>
      WEEKLY_SCHEDULE.map((d, di) => ({
        type: d.type, label: d.label, durationMin: d.durationMin,
        done: doneMap.get(`${wi}-${di}`) ?? false,
      })),
    );
  }

  return ok({
    profile: profile
      ? { startWeightKg: profile.startWeightKg, goalWeightKg: profile.goalWeightKg, durationWeeks: profile.durationWeeks, startDate: profile.startDate.toISOString() }
      : null,
    weekData, weights, sleeps, sessions,
  });
}

export async function upsertProfile(args: {
  memberId: string; tenantId: string;
  startWeightKg: number; goalWeightKg: number; durationWeeks: number; startDate: string;
  prisma: PrismaClient;
}) {
  const { memberId, tenantId, startWeightKg, goalWeightKg, durationWeeks, startDate, prisma } = args;
  if (![4, 8, 12].includes(durationWeeks)) return err("DUREE_INVALIDE");
  if (!(startWeightKg > 0) || !(goalWeightKg > 0)) return err("POIDS_INVALIDE");

  await prisma.$transaction(async (tx: Tx) => {
    const existing = await tx.fitnessProfile.findFirst({ where: { memberId, tenantId } });
    await tx.fitnessProfile.upsert({
      where: { memberId },
      create: { memberId, tenantId, startWeightKg, goalWeightKg, durationWeeks, startDate: new Date(startDate) },
      update: { startWeightKg, goalWeightKg, durationWeeks, startDate: new Date(startDate) },
    });
    if (!existing) {
      const rows = [];
      for (let wi = 0; wi < durationWeeks; wi++) {
        for (let di = 0; di < WEEKLY_SCHEDULE.length; di++) {
          rows.push({ memberId, tenantId, weekIndex: wi, dayIndex: di, done: false });
        }
      }
      await tx.fitnessDayProgress.createMany({ data: rows });
    }
  });
  return ok({ memberId });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- fitness-tracking`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server-actions/fitness-tracking.ts tests/lib/server-actions/fitness-tracking.test.ts
git commit -m "feat(fitness): getFitnessData + upsertProfile server actions"
```

---

## Task 3: Server actions — weights, sessions, day-progress + isolation test

**Files:**
- Modify: `src/lib/server-actions/fitness-tracking.ts`
- Modify: `tests/lib/server-actions/fitness-tracking.test.ts`

- [ ] **Step 1: Write failing tests**

Add to the `describe("fitness-tracking", ...)` block in `tests/lib/server-actions/fitness-tracking.test.ts`:

```typescript
  it("addWeightLog + addWorkoutSession surface in getFitnessData", async () => {
    const { tenantId, memberId } = await seedMember();
    await addWeightLog({ memberId, tenantId, date: "2026-06-02T00:00:00.000Z", weightKg: 79.5, sleepHours: 7, prisma: testPrisma });
    await addWorkoutSession({ memberId, tenantId, date: "2026-06-02T00:00:00.000Z", programId: null, programName: "Marche", durationMin: 30, kind: "marche", prisma: testPrisma });
    const r = await getFitnessData({ memberId, tenantId, prisma: testPrisma });
    expect(r.success && r.data.weights.length).toBe(1);
    expect(r.success && r.data.sleeps.length).toBe(1);
    expect(r.success && r.data.sessions.length).toBe(1);
    expect(r.success && r.data.sessions[0].programName).toBe("Marche");
  });

  it("toggleDayProgress flips done flag", async () => {
    const { tenantId, memberId } = await seedMember();
    await upsertProfile({ memberId, tenantId, startWeightKg: 80, goalWeightKg: 72, durationWeeks: 4, startDate: "2026-06-01T00:00:00.000Z", prisma: testPrisma });
    await toggleDayProgress({ memberId, tenantId, weekIndex: 0, dayIndex: 0, prisma: testPrisma });
    const r = await getFitnessData({ memberId, tenantId, prisma: testPrisma });
    expect(r.success && r.data.weekData[0][0].done).toBe(true);
    await toggleDayProgress({ memberId, tenantId, weekIndex: 0, dayIndex: 0, prisma: testPrisma });
    const r2 = await getFitnessData({ memberId, tenantId, prisma: testPrisma });
    expect(r2.success && r2.data.weekData[0][0].done).toBe(false);
  });

  it("tenant isolation: member never sees another tenant's data", async () => {
    const a = await seedMember();
    const b = await seedMember();
    await addWeightLog({ memberId: a.memberId, tenantId: a.tenantId, date: "2026-06-02T00:00:00.000Z", weightKg: 79.5, prisma: testPrisma });
    const r = await getFitnessData({ memberId: a.memberId, tenantId: b.tenantId, prisma: testPrisma });
    expect(r.success && r.data.weights.length).toBe(0);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- fitness-tracking`
Expected: FAIL — `addWeightLog`/`addWorkoutSession`/`toggleDayProgress` not exported.

- [ ] **Step 3: Implement the three actions**

Append to `src/lib/server-actions/fitness-tracking.ts`:

```typescript
export async function addWeightLog(args: {
  memberId: string; tenantId: string; date: string; weightKg: number; sleepHours?: number | null;
  prisma: PrismaClient;
}) {
  const { memberId, tenantId, date, weightKg, sleepHours, prisma } = args;
  if (!(weightKg > 0)) return err("POIDS_INVALIDE");
  await prisma.fitnessWeightLog.create({
    data: { memberId, tenantId, date: new Date(date), weightKg, sleepHours: sleepHours ?? null },
  });
  return ok({ memberId });
}

export async function addWorkoutSession(args: {
  memberId: string; tenantId: string; date: string;
  programId?: string | null; programName: string; durationMin: number; kind: string;
  prisma: PrismaClient;
}) {
  const { memberId, tenantId, date, programId, programName, durationMin, kind, prisma } = args;
  if (!programName.trim()) return err("NOM_REQUIS");
  await prisma.fitnessWorkoutSession.create({
    data: { memberId, tenantId, date: new Date(date), programId: programId ?? null, programName: programName.trim(), durationMin, kind },
  });
  return ok({ memberId });
}

export async function toggleDayProgress(args: {
  memberId: string; tenantId: string; weekIndex: number; dayIndex: number; prisma: PrismaClient;
}) {
  const { memberId, tenantId, weekIndex, dayIndex, prisma } = args;
  const row = await prisma.fitnessDayProgress.findFirst({ where: { memberId, tenantId, weekIndex, dayIndex } });
  if (!row) return err("INTROUVABLE");
  await prisma.fitnessDayProgress.update({ where: { id: row.id }, data: { done: !row.done } });
  return ok({ done: !row.done });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- fitness-tracking`
Expected: PASS (5 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server-actions/fitness-tracking.ts tests/lib/server-actions/fitness-tracking.test.ts
git commit -m "feat(fitness): weight/session/day-progress actions + tenant isolation test"
```

---

## Task 4: REST API routes (dual-auth)

**Files:**
- Create: `src/app/api/me/fitness/data/route.ts`
- Create: `src/app/api/me/fitness/profile/route.ts`
- Create: `src/app/api/me/fitness/weights/route.ts`
- Create: `src/app/api/me/fitness/sessions/route.ts`
- Create: `src/app/api/me/fitness/day-progress/route.ts`

- [ ] **Step 1: Create a shared auth resolver inline in each route**

All 5 routes share this resolve pattern (copied from `programs/route.ts`). Create `src/app/api/me/fitness/data/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { authMobileRequest } from "@/lib/mobile-auth-context";
import { getFitnessData } from "@/lib/server-actions/fitness-tracking";

export const dynamic = "force-dynamic";

async function resolve(req: Request) {
  const ctx = await getCurrentAuthContext();
  if (ctx?.userId) return { userId: ctx.userId, tenantId: ctx.tenantId ?? null };
  const mobile = await authMobileRequest(req);
  if (!mobile) return null;
  const u = await prisma.user.findUnique({ where: { id: mobile.userId }, select: { id: true, tenantId: true } });
  if (!u) return null;
  return { userId: u.id, tenantId: u.tenantId };
}

export async function GET(req: Request) {
  const who = await resolve(req);
  if (!who) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!who.tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });
  const r = await getFitnessData({ memberId: who.userId, tenantId: who.tenantId, prisma });
  if (!r.success) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json(r.data);
}
```

- [ ] **Step 2: Create profile route**

Create `src/app/api/me/fitness/profile/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { authMobileRequest } from "@/lib/mobile-auth-context";
import { upsertProfile } from "@/lib/server-actions/fitness-tracking";

export const dynamic = "force-dynamic";

async function resolve(req: Request) {
  const ctx = await getCurrentAuthContext();
  if (ctx?.userId) return { userId: ctx.userId, tenantId: ctx.tenantId ?? null };
  const mobile = await authMobileRequest(req);
  if (!mobile) return null;
  const u = await prisma.user.findUnique({ where: { id: mobile.userId }, select: { id: true, tenantId: true } });
  if (!u) return null;
  return { userId: u.id, tenantId: u.tenantId };
}

export async function POST(req: Request) {
  const who = await resolve(req);
  if (!who) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!who.tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const r = await upsertProfile({
    memberId: who.userId, tenantId: who.tenantId,
    startWeightKg: Number(body.startWeightKg), goalWeightKg: Number(body.goalWeightKg),
    durationWeeks: Number(body.durationWeeks), startDate: String(body.startDate), prisma,
  });
  if (!r.success) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json(r.data);
}
```

- [ ] **Step 3: Create weights route**

Create `src/app/api/me/fitness/weights/route.ts` (same `resolve` helper + import `addWeightLog`):

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { authMobileRequest } from "@/lib/mobile-auth-context";
import { addWeightLog } from "@/lib/server-actions/fitness-tracking";

export const dynamic = "force-dynamic";

async function resolve(req: Request) {
  const ctx = await getCurrentAuthContext();
  if (ctx?.userId) return { userId: ctx.userId, tenantId: ctx.tenantId ?? null };
  const mobile = await authMobileRequest(req);
  if (!mobile) return null;
  const u = await prisma.user.findUnique({ where: { id: mobile.userId }, select: { id: true, tenantId: true } });
  if (!u) return null;
  return { userId: u.id, tenantId: u.tenantId };
}

export async function POST(req: Request) {
  const who = await resolve(req);
  if (!who) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!who.tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const r = await addWeightLog({
    memberId: who.userId, tenantId: who.tenantId,
    date: String(body.date), weightKg: Number(body.weightKg),
    sleepHours: body.sleepHours == null ? null : Number(body.sleepHours), prisma,
  });
  if (!r.success) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json(r.data);
}
```

- [ ] **Step 4: Create sessions route**

Create `src/app/api/me/fitness/sessions/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { authMobileRequest } from "@/lib/mobile-auth-context";
import { addWorkoutSession } from "@/lib/server-actions/fitness-tracking";

export const dynamic = "force-dynamic";

async function resolve(req: Request) {
  const ctx = await getCurrentAuthContext();
  if (ctx?.userId) return { userId: ctx.userId, tenantId: ctx.tenantId ?? null };
  const mobile = await authMobileRequest(req);
  if (!mobile) return null;
  const u = await prisma.user.findUnique({ where: { id: mobile.userId }, select: { id: true, tenantId: true } });
  if (!u) return null;
  return { userId: u.id, tenantId: u.tenantId };
}

export async function POST(req: Request) {
  const who = await resolve(req);
  if (!who) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!who.tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const r = await addWorkoutSession({
    memberId: who.userId, tenantId: who.tenantId,
    date: String(body.date), programId: body.programId ?? null,
    programName: String(body.programName), durationMin: Number(body.durationMin),
    kind: String(body.kind), prisma,
  });
  if (!r.success) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json(r.data);
}
```

- [ ] **Step 5: Create day-progress route**

Create `src/app/api/me/fitness/day-progress/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { authMobileRequest } from "@/lib/mobile-auth-context";
import { toggleDayProgress } from "@/lib/server-actions/fitness-tracking";

export const dynamic = "force-dynamic";

async function resolve(req: Request) {
  const ctx = await getCurrentAuthContext();
  if (ctx?.userId) return { userId: ctx.userId, tenantId: ctx.tenantId ?? null };
  const mobile = await authMobileRequest(req);
  if (!mobile) return null;
  const u = await prisma.user.findUnique({ where: { id: mobile.userId }, select: { id: true, tenantId: true } });
  if (!u) return null;
  return { userId: u.id, tenantId: u.tenantId };
}

export async function POST(req: Request) {
  const who = await resolve(req);
  if (!who) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!who.tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const r = await toggleDayProgress({
    memberId: who.userId, tenantId: who.tenantId,
    weekIndex: Number(body.weekIndex), dayIndex: Number(body.dayIndex), prisma,
  });
  if (!r.success) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json(r.data);
}
```

- [ ] **Step 6: Verify typecheck + build**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/me/fitness/
git commit -m "feat(fitness): dual-auth REST routes (data/profile/weights/sessions/day-progress)"
```

---

## Task 5: Refactor web useFitApp to use APIs

**Files:**
- Modify: `src/hooks/use-fit-app.ts`

- [ ] **Step 1: Replace localStorage with API fetch + one-shot migration**

Replace the entire body of `src/hooks/use-fit-app.ts` with:

```typescript
"use client";
import { useCallback, useEffect, useState } from "react";
import type { FitAppData, FitProfile, WeightEntry, SleepEntry, SessionEntry } from "@/components/member/fitness/types";

const LEGACY_KEY = "fitapp_v3";

function emptyData(): FitAppData {
  return { profile: null, weekData: [], weights: [], sleeps: [], sessions: [] };
}

async function getJSON(url: string): Promise<FitAppData> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${url} ${res.status}`);
  return (await res.json()) as FitAppData;
}
async function postJSON(url: string, body: unknown): Promise<void> {
  await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export function useFitApp() {
  const [data, setData] = useState<FitAppData>(emptyData);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try { setData(await getJSON("/api/me/fitness/data")); }
    catch { /* keep current */ }
  }, []);

  // initial load + one-shot localStorage migration
  useEffect(() => {
    (async () => {
      let server = emptyData();
      try { server = await getJSON("/api/me/fitness/data"); } catch { /* offline */ }
      if (!server.profile && typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem(LEGACY_KEY);
          if (raw) {
            const local = JSON.parse(raw) as FitAppData;
            if (local.profile) {
              await postJSON("/api/me/fitness/profile", local.profile);
              for (const w of local.weights) {
                const sleep = local.sleeps.find((s) => s.date === w.date);
                await postJSON("/api/me/fitness/weights", { ...w, sleepHours: sleep?.hours ?? null });
              }
              for (const s of local.sessions) {
                await postJSON("/api/me/fitness/sessions", { date: s.date, programId: s.programId === "walk" ? null : s.programId, programName: s.programName, durationMin: s.durationMin, kind: s.programId === "walk" ? "marche" : "muscu" });
              }
              localStorage.removeItem(LEGACY_KEY);
              server = await getJSON("/api/me/fitness/data");
            }
          }
        } catch { /* best-effort */ }
      }
      setData(server);
      setLoaded(true);
    })();
  }, []);

  const setProfile = useCallback(async (profile: FitProfile) => {
    setData((d) => ({ ...d, profile }));
    await postJSON("/api/me/fitness/profile", profile);
    await refresh();
  }, [refresh]);

  const toggleDay = useCallback(async (week: number, day: number) => {
    setData((d) => ({
      ...d,
      weekData: d.weekData.map((w, wi) => wi === week ? w.map((dd, di) => di === day ? { ...dd, done: !dd.done } : dd) : w),
    }));
    await postJSON("/api/me/fitness/day-progress", { weekIndex: week, dayIndex: day });
  }, []);

  const addWeight = useCallback(async (entry: WeightEntry, sleep?: SleepEntry) => {
    setData((d) => ({ ...d, weights: [...d.weights, entry], sleeps: sleep ? [...d.sleeps, sleep] : d.sleeps }));
    await postJSON("/api/me/fitness/weights", { ...entry, sleepHours: sleep?.hours ?? null });
  }, []);

  const addSession = useCallback(async (entry: SessionEntry) => {
    setData((d) => ({ ...d, sessions: [entry, ...d.sessions] }));
    await postJSON("/api/me/fitness/sessions", {
      date: entry.date, programId: entry.programId === "walk" ? null : entry.programId,
      programName: entry.programName, durationMin: entry.durationMin,
      kind: entry.programId === "walk" ? "marche" : "muscu",
    });
  }, []);

  const reset = useCallback(() => { setData(emptyData()); }, []);

  return { data, loaded, setProfile, toggleDay, addWeight, addSession, reset };
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS. (If a tab component awaits a return value from these callbacks, that's fine — they now return Promises but callers ignore them.)

- [ ] **Step 3: Manual smoke test (web)**

Run: `npm run dev`, log in as a MEMBER, open `/me/fitness`. Set a profile, log a weight, toggle a day, finish a walk session. Reload page — data persists.
Expected: data survives reload (now from DB, not localStorage).

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-fit-app.ts
git commit -m "refactor(fitness): web useFitApp reads/writes DB via API + localStorage migration"
```

---

## Task 6: Mobile fitness lib (types + API)

**Files:**
- Create: `mobile/src/lib/fitness.ts`

- [ ] **Step 1: Create shared types + schedule + API calls**

Create `mobile/src/lib/fitness.ts`:

```typescript
import { apiFetch } from "./api";

export interface FitProfile { startWeightKg: number; goalWeightKg: number; durationWeeks: number; startDate: string }
export interface WeekDay { type: string; label: string; durationMin: number | null; done: boolean }
export interface WeightEntry { date: string; weightKg: number }
export interface SleepEntry { date: string; hours: number }
export interface SessionEntry { date: string; programId: string; programName: string; durationMin: number }
export interface FitData {
  profile: FitProfile | null;
  weekData: WeekDay[][];
  weights: WeightEntry[];
  sleeps: SleepEntry[];
  sessions: SessionEntry[];
}
export interface ExerciseDTO {
  id: string; name: string; sets: number; repsOrDurationSec: number;
  recoverySec: number; muscles: string; steps: string[]; tip: string | null; order: number;
}
export interface ProgramDTO {
  id: string; name: string; color: string; type: string; createdById: string | null; exercises: ExerciseDTO[];
}

export const WEEKLY_SCHEDULE: { type: string; label: string; durationMin: number | null }[] = [
  { type: "muscu", label: "Full Body", durationMin: 40 },
  { type: "marche", label: "Marche Japonaise", durationMin: 30 },
  { type: "muscu", label: "Gainage & Abdos", durationMin: 35 },
  { type: "repos", label: "Repos", durationMin: null },
  { type: "muscu", label: "Jambes & Fessiers", durationMin: 40 },
  { type: "course", label: "Course", durationMin: 30 },
  { type: "yoga", label: "Yoga / Étirements", durationMin: 20 },
];

export function fetchFitData(token: string) { return apiFetch<FitData>("/api/me/fitness/data", { token }); }
export function fetchPrograms(token: string) { return apiFetch<ProgramDTO[]>("/api/me/fitness/programs", { token }); }
export function postProfile(token: string, p: FitProfile) {
  return apiFetch("/api/me/fitness/profile", { method: "POST", token, body: JSON.stringify(p) });
}
export function postWeight(token: string, body: { date: string; weightKg: number; sleepHours: number | null }) {
  return apiFetch("/api/me/fitness/weights", { method: "POST", token, body: JSON.stringify(body) });
}
export function postSession(token: string, body: { date: string; programId: string | null; programName: string; durationMin: number; kind: string }) {
  return apiFetch("/api/me/fitness/sessions", { method: "POST", token, body: JSON.stringify(body) });
}
export function postDayProgress(token: string, body: { weekIndex: number; dayIndex: number }) {
  return apiFetch("/api/me/fitness/day-progress", { method: "POST", token, body: JSON.stringify(body) });
}

export function walkCalories(minutes: number): number { return Math.round(minutes * 7); }
```

- [ ] **Step 2: Verify mobile typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/lib/fitness.ts
git commit -m "feat(mobile): fitness lib — types, schedule, API client"
```

---

## Task 7: Mobile useFitApp hook

**Files:**
- Create: `mobile/src/hooks/useFitApp.ts`

- [ ] **Step 1: Create the hook**

Create `mobile/src/hooks/useFitApp.ts`:

```typescript
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  fetchFitData, postProfile, postWeight, postSession, postDayProgress,
  type FitData, type FitProfile, type WeightEntry, type SleepEntry, type SessionEntry,
} from "../lib/fitness";

function empty(): FitData {
  return { profile: null, weekData: [], weights: [], sleeps: [], sessions: [] };
}

export function useFitApp() {
  const { token } = useAuth();
  const [data, setData] = useState<FitData>(empty);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) return;
    try { setData(await fetchFitData(token)); } catch { /* keep */ }
  }, [token]);

  useEffect(() => { (async () => { await refresh(); setLoaded(true); })(); }, [refresh]);

  const setProfile = useCallback(async (p: FitProfile) => {
    if (!token) return;
    setData((d) => ({ ...d, profile: p }));
    await postProfile(token, p);
    await refresh();
  }, [token, refresh]);

  const toggleDay = useCallback(async (week: number, day: number) => {
    if (!token) return;
    setData((d) => ({ ...d, weekData: d.weekData.map((w, wi) => wi === week ? w.map((dd, di) => di === day ? { ...dd, done: !dd.done } : dd) : w) }));
    await postDayProgress(token, { weekIndex: week, dayIndex: day });
  }, [token]);

  const addWeight = useCallback(async (entry: WeightEntry, sleep?: SleepEntry) => {
    if (!token) return;
    setData((d) => ({ ...d, weights: [...d.weights, entry], sleeps: sleep ? [...d.sleeps, sleep] : d.sleeps }));
    await postWeight(token, { date: entry.date, weightKg: entry.weightKg, sleepHours: sleep?.hours ?? null });
  }, [token]);

  const addSession = useCallback(async (entry: SessionEntry) => {
    if (!token) return;
    setData((d) => ({ ...d, sessions: [entry, ...d.sessions] }));
    await postSession(token, {
      date: entry.date, programId: entry.programId === "walk" ? null : entry.programId,
      programName: entry.programName, durationMin: entry.durationMin,
      kind: entry.programId === "walk" ? "marche" : "muscu",
    });
  }, [token]);

  return { data, loaded, refresh, setProfile, toggleDay, addWeight, addSession };
}
```

- [ ] **Step 2: Verify AuthContext exposes `token`**

Run: `grep -n "token" mobile/src/context/AuthContext.tsx | head`
Expected: `token` is part of the context value. (If named differently, adjust the hook import accordingly.)

- [ ] **Step 3: Verify mobile typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/hooks/useFitApp.ts
git commit -m "feat(mobile): useFitApp hook (API-backed, optimistic)"
```

---

## Task 8: Mobile FitnessScreen (4 tabs)

**Files:**
- Create: `mobile/src/screens/FitnessScreen.tsx`

- [ ] **Step 1: Create the screen**

Create `mobile/src/screens/FitnessScreen.tsx`. Internal segmented control switches between 4 sub-views. Muscu/Marche use timers; Poids logs weight; Programme shows weekData + lets you toggle days. Programs (for muscu) loaded via `fetchPrograms`.

```typescript
import React, { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useFitApp } from "../hooks/useFitApp";
import { fetchPrograms, walkCalories, type ProgramDTO } from "../lib/fitness";

const ACCENT = "#C8FF00";
const TABS = ["Programme", "Muscu", "Marche", "Poids"] as const;
type TabKey = (typeof TABS)[number];

export function FitnessScreen() {
  const [tab, setTab] = useState<TabKey>("Programme");
  const fit = useFitApp();
  return (
    <View style={s.root}>
      <View style={s.tabbar}>
        {TABS.map((t) => (
          <TouchableOpacity key={t} style={[s.tabBtn, tab === t && s.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab === "Programme" && <ProgrammeTab fit={fit} />}
      {tab === "Muscu" && <MuscuTab fit={fit} />}
      {tab === "Marche" && <MarcheTab fit={fit} />}
      {tab === "Poids" && <PoidsTab fit={fit} />}
    </View>
  );
}

function ProgrammeTab({ fit }: { fit: ReturnType<typeof useFitApp> }) {
  const { data } = fit;
  if (!data.profile) {
    return <ProfileSetup fit={fit} />;
  }
  return (
    <ScrollView contentContainerStyle={s.pad}>
      {data.weekData.map((week, wi) => (
        <View key={wi} style={s.card}>
          <Text style={s.h2}>Semaine {wi + 1}</Text>
          {week.map((d, di) => (
            <TouchableOpacity key={di} style={s.dayRow} onPress={() => fit.toggleDay(wi, di)}>
              <Text style={[s.dayTxt, d.done && s.dayDone]}>
                {d.done ? "☑" : "☐"} {d.label}{d.durationMin ? ` · ${d.durationMin} min` : ""}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

function ProfileSetup({ fit }: { fit: ReturnType<typeof useFitApp> }) {
  const [start, setStart] = useState("");
  const [goal, setGoal] = useState("");
  const [weeks, setWeeks] = useState<4 | 8 | 12>(8);
  function save() {
    const sw = parseFloat(start), gw = parseFloat(goal);
    if (Number.isNaN(sw) || Number.isNaN(gw)) return;
    fit.setProfile({ startWeightKg: sw, goalWeightKg: gw, durationWeeks: weeks, startDate: new Date().toISOString() });
  }
  return (
    <ScrollView contentContainerStyle={s.pad}>
      <Text style={s.h1}>Configure ton programme</Text>
      <Text style={s.label}>Poids de départ (kg)</Text>
      <TextInput style={s.input} keyboardType="numeric" value={start} onChangeText={setStart} />
      <Text style={s.label}>Objectif (kg)</Text>
      <TextInput style={s.input} keyboardType="numeric" value={goal} onChangeText={setGoal} />
      <Text style={s.label}>Durée</Text>
      <View style={s.row}>
        {[4, 8, 12].map((w) => (
          <TouchableOpacity key={w} style={[s.chip, weeks === w && s.chipActive]} onPress={() => setWeeks(w as 4 | 8 | 12)}>
            <Text style={[s.chipTxt, weeks === w && s.chipTxtActive]}>{w} sem.</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={s.cta} onPress={save}><Text style={s.ctaTxt}>Démarrer</Text></TouchableOpacity>
    </ScrollView>
  );
}

function MuscuTab({ fit }: { fit: ReturnType<typeof useFitApp> }) {
  const { token } = useAuth();
  const [programs, setPrograms] = useState<ProgramDTO[]>([]);
  const [active, setActive] = useState<ProgramDTO | null>(null);
  useEffect(() => { if (token) fetchPrograms(token).then(setPrograms).catch(() => {}); }, [token]);

  if (active) return <Session program={active} onDone={(min) => { fit.addSession({ date: new Date().toISOString(), programId: active.id, programName: active.name, durationMin: min }); setActive(null); }} onCancel={() => setActive(null)} />;

  return (
    <ScrollView contentContainerStyle={s.pad}>
      <Text style={s.h1}>Renforcement musculaire</Text>
      {programs.length === 0 && <Text style={s.muted}>Aucun programme.</Text>}
      {programs.map((p) => (
        <TouchableOpacity key={p.id} style={s.card} onPress={() => setActive(p)}>
          <Text style={s.h2}>{p.name}</Text>
          <Text style={s.muted}>{p.exercises.length} exercices</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function Session({ program, onDone, onCancel }: { program: ProgramDTO; onDone: (min: number) => void; onCancel: () => void }) {
  const [idx, setIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => { ref.current = setInterval(() => setElapsed((e) => e + 1), 1000); return () => { if (ref.current) clearInterval(ref.current); }; }, []);
  const ex = program.exercises[idx];
  const isLast = idx >= program.exercises.length - 1;
  const mm = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  return (
    <ScrollView contentContainerStyle={s.pad}>
      <Text style={s.muted}>{mm} · {idx + 1}/{program.exercises.length}</Text>
      <Text style={s.h1}>{ex.name}</Text>
      <Text style={s.body}>{ex.sets} séries × {ex.repsOrDurationSec < 100 ? `${ex.repsOrDurationSec} reps` : `${ex.repsOrDurationSec}s`}</Text>
      <Text style={s.muted}>Récup {ex.recoverySec}s · {ex.muscles}</Text>
      {ex.steps.map((st, i) => <Text key={i} style={s.body}>• {st}</Text>)}
      {ex.tip ? <Text style={s.tip}>💡 {ex.tip}</Text> : null}
      {!isLast
        ? <TouchableOpacity style={s.cta} onPress={() => setIdx((i) => i + 1)}><Text style={s.ctaTxt}>Exercice suivant</Text></TouchableOpacity>
        : <TouchableOpacity style={s.cta} onPress={() => onDone(Math.max(1, Math.round(elapsed / 60)))}><Text style={s.ctaTxt}>Terminer la séance</Text></TouchableOpacity>}
      <TouchableOpacity style={s.cancel} onPress={onCancel}><Text style={s.cancelTxt}>Abandonner</Text></TouchableOpacity>
    </ScrollView>
  );
}

const WALK_SEC = 120, FAST_SEC = 180, CYCLE = 300, TOTAL = 1800;
function MarcheTab({ fit }: { fit: ReturnType<typeof useFitApp> }) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (running) ref.current = setInterval(() => setElapsed((e) => Math.min(e + 1, TOTAL)), 1000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [running]);
  useEffect(() => { if (elapsed >= TOTAL) setRunning(false); }, [elapsed]);
  const inCycle = elapsed % CYCLE;
  const phase = inCycle < WALK_SEC ? "MARCHE (6 km/h)" : "RAPIDE (8 km/h)";
  const done = elapsed >= TOTAL;
  const mm = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  function save() {
    fit.addSession({ date: new Date().toISOString(), programId: "walk", programName: "Marche Japonaise", durationMin: Math.max(1, Math.round(elapsed / 60)) });
    setElapsed(0); setRunning(false);
  }
  return (
    <ScrollView contentContainerStyle={s.pad}>
      <Text style={s.h1}>Marche Japonaise</Text>
      <Text style={s.timer}>{mm}</Text>
      <Text style={s.h2}>{phase}</Text>
      <Text style={s.muted}>Calories ~{walkCalories(elapsed / 60)} kcal · 30 min cible</Text>
      {!done
        ? <TouchableOpacity style={s.cta} onPress={() => setRunning((r) => !r)}><Text style={s.ctaTxt}>{running ? "Pause" : "Démarrer"}</Text></TouchableOpacity>
        : <TouchableOpacity style={s.cta} onPress={save}><Text style={s.ctaTxt}>Enregistrer</Text></TouchableOpacity>}
      <TouchableOpacity style={s.cancel} onPress={() => { setElapsed(0); setRunning(false); }}><Text style={s.cancelTxt}>Réinitialiser</Text></TouchableOpacity>
    </ScrollView>
  );
}

function PoidsTab({ fit }: { fit: ReturnType<typeof useFitApp> }) {
  const { data } = fit;
  const [weight, setWeight] = useState("");
  const [sleep, setSleep] = useState("");
  const latest = data.weights.length ? data.weights[data.weights.length - 1].weightKg : data.profile?.startWeightKg ?? 0;
  function submit() {
    const w = parseFloat(weight);
    if (Number.isNaN(w)) return;
    const iso = new Date().toISOString();
    const s2 = parseFloat(sleep);
    fit.addWeight({ date: iso, weightKg: w }, Number.isNaN(s2) ? undefined : { date: iso, hours: s2 });
    setWeight(""); setSleep("");
  }
  return (
    <ScrollView contentContainerStyle={s.pad}>
      <Text style={s.timer}>{latest.toFixed(1)} kg</Text>
      <Text style={s.label}>Poids (kg)</Text>
      <TextInput style={s.input} keyboardType="numeric" value={weight} onChangeText={setWeight} />
      <Text style={s.label}>Sommeil (h) — optionnel</Text>
      <TextInput style={s.input} keyboardType="numeric" value={sleep} onChangeText={setSleep} />
      <TouchableOpacity style={s.cta} onPress={submit}><Text style={s.ctaTxt}>Enregistrer</Text></TouchableOpacity>
      <View style={{ marginTop: 16 }}>
        <Text style={s.h2}>Historique</Text>
        {data.weights.slice().reverse().map((w, i) => (
          <Text key={i} style={s.body}>{new Date(w.date).toLocaleDateString("fr-FR")} — {w.weightKg.toFixed(1)} kg</Text>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0f172a" },
  tabbar: { flexDirection: "row", backgroundColor: "#1e293b", borderBottomColor: "#334155", borderBottomWidth: 1 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabBtnActive: { borderBottomColor: ACCENT, borderBottomWidth: 2 },
  tabTxt: { color: "#94a3b8", fontSize: 13 },
  tabTxtActive: { color: ACCENT, fontWeight: "600" },
  pad: { padding: 16 },
  h1: { color: "#f1f5f9", fontSize: 20, fontWeight: "700", marginBottom: 8 },
  h2: { color: "#f1f5f9", fontSize: 16, fontWeight: "600", marginBottom: 4 },
  body: { color: "#cbd5e1", fontSize: 14, marginVertical: 2 },
  muted: { color: "#64748b", fontSize: 13, marginVertical: 2 },
  tip: { color: ACCENT, fontSize: 13, marginTop: 6 },
  timer: { color: ACCENT, fontSize: 44, fontWeight: "800", textAlign: "center", marginVertical: 8 },
  card: { backgroundColor: "#1e293b", borderColor: "#334155", borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 12 },
  dayRow: { paddingVertical: 6 },
  dayTxt: { color: "#cbd5e1", fontSize: 14 },
  dayDone: { color: ACCENT },
  label: { color: "#94a3b8", fontSize: 12, marginTop: 10, marginBottom: 4 },
  input: { backgroundColor: "#0f172a", borderColor: "#334155", borderWidth: 1, borderRadius: 8, color: "#f1f5f9", paddingHorizontal: 12, paddingVertical: 10 },
  row: { flexDirection: "row", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#1e293b", borderColor: "#334155", borderWidth: 1 },
  chipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  chipTxt: { color: "#94a3b8" },
  chipTxtActive: { color: "#0f172a", fontWeight: "700" },
  cta: { backgroundColor: ACCENT, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 16 },
  ctaTxt: { color: "#0f172a", fontWeight: "700", fontSize: 15 },
  cancel: { paddingVertical: 10, alignItems: "center", marginTop: 8 },
  cancelTxt: { color: "#64748b" },
});
```

- [ ] **Step 2: Verify mobile typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/screens/FitnessScreen.tsx
git commit -m "feat(mobile): FitnessScreen with Programme/Muscu/Marche/Poids tabs"
```

---

## Task 9: Wire screen into navigation

**Files:**
- Modify: `mobile/src/navigation/AppNavigator.tsx`

- [ ] **Step 1: Import the screen**

In `mobile/src/navigation/AppNavigator.tsx`, add with the other screen imports:

```typescript
import { FitnessScreen } from "../screens/FitnessScreen";
```

- [ ] **Step 2: Add the Tab.Screen**

In the `<Tab.Navigator>` block, add after the "Abonnement" `Tab.Screen`:

```typescript
          <Tab.Screen
            name="Forme"
            component={FitnessScreen}
            options={{ tabBarIcon: ({ color, size }) => <Ionicons name="barbell-outline" size={size} color={color} /> }}
          />
```

- [ ] **Step 3: Verify mobile typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Manual smoke test (mobile)**

Run: `cd mobile && npx expo start --tunnel`, open in Expo Go on phone, log in as MEMBER. Tap "Forme" tab. Configure profile → toggle a day → run a muscu session → run a walk → log a weight. Reload app: data persists (from DB).
Expected: all 4 tabs functional, data survives app restart.

- [ ] **Step 4b: Cross-device check**

Log the same member on web `/me/fitness` — the weight/session logged on mobile appears.
Expected: web and mobile show the same data.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/navigation/AppNavigator.tsx
git commit -m "feat(mobile): add Forme tab to navigation"
```

---

## Task 10: Full test run + final verification

- [ ] **Step 1: Run full web test suite**

Run: `npm test`
Expected: all tests pass (154 prior + new fitness-tracking tests).

- [ ] **Step 2: Web typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 3: Mobile typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit any fixes, then summarize**

If steps 1-3 needed fixes, commit them. Then the branch `feat/fitness-tracking-mobile` is ready for review/merge and a new mobile build.

---

## Post-implementation (out of plan scope, do when asked)

- Bump `mobile/app.json` version → `1.2.0`, run `eas build --platform android --profile production`, upload `.aab` to Play Console.
- Update memory file `project_gym_management_saas.md` with the new fitness tracking DB persistence + mobile screen.
