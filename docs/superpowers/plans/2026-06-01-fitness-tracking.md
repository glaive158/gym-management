# Fitness Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fitness tracking module to the member space (`/me/fitness`) where members configure a weight-loss/muscle-gain program, log workouts, track body weight, and follow exercise programs created by their gym manager or themselves.

**Architecture:** Exercise programs live in PostgreSQL (Prisma, tenant + gym scoped, manager-managed or member-private). Member progression data (weight logs, sleep, week completion, sessions) lives client-side in `localStorage` key `fitapp_v3`. Programs reach the UI via server actions and a member API route; the tracker UI is a self-contained React component with 5 tabs and a bottom nav, using native SVG timers and zero external chart/icon deps.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma 6, PostgreSQL, NextAuth, Tailwind, Vitest.

---

## File Structure

**New library / logic files:**
- `src/lib/fitness-utils.ts` — pure functions (week calc, weight interpolation, calories)
- `src/lib/fitness-defaults.ts` — hardcoded data for 4 default programs + weekly day distribution + calorie targets
- `src/lib/server-actions/fitness-program-crud.ts` — CRUD server actions for programs + exercises (manager + member)
- `src/lib/fitness-seed.ts` — seed 4 default programs for a gym

**New API route (mobile + client fetch):**
- `src/app/api/me/fitness/programs/route.ts` — GET programs visible to member

**New hook:**
- `src/hooks/use-fit-app.ts` — typed localStorage state for `fitapp_v3`

**New member UI:**
- `src/app/me/fitness/page.tsx` — server wrapper (session + load programs)
- `src/components/member/fitness-tracker.tsx` — main component (tabs + bottom nav + onboarding)
- `src/components/member/fitness/tab-home.tsx`
- `src/components/member/fitness/tab-walk.tsx`
- `src/components/member/fitness/tab-program.tsx`
- `src/components/member/fitness/tab-muscu.tsx`
- `src/components/member/fitness/tab-weight.tsx`
- `src/components/member/fitness/session-overlay.tsx`
- `src/components/member/fitness/circular-timer.tsx` — reusable SVG ring
- `src/components/member/fitness/types.ts` — shared TS types (program, exercise, fitapp data)

**New manager UI:**
- `src/app/manager/fitness/page.tsx` — list programs
- `src/app/manager/fitness/new/page.tsx` — create program
- `src/app/manager/fitness/[id]/page.tsx` — edit program + exercises
- `src/components/manager/fitness-program-form.tsx`
- `src/components/manager/fitness-exercise-editor.tsx`

**Modified files:**
- `prisma/schema.prisma` — add `FitnessProgramType` enum, `FitnessProgram`, `FitnessExercise`; relations on `Tenant`, `Gym`, `User`
- `tests/helpers/db.ts` — add fitness deletes to `resetDb()`
- `src/lib/server-actions/gym-crud.ts` — call `seedDefaultFitnessPrograms` after gym create
- `src/app/me/page.tsx` — add "Fitness" link card
- `src/app/manager/page.tsx` or manager nav — add "Programmes fitness" link

**New tests:**
- `tests/lib/fitness-utils.test.ts`
- `tests/lib/server-actions/fitness-program-crud.test.ts`
- `tests/lib/fitness-seed.test.ts`

---

## Conventions (read before starting)

- API/server auth: `getCurrentAuthContext()` returns `{ userId, role, tenantId, gymId } | null`.
- Server actions take an injected `prisma` arg and return `{ success: true, data } | { success: false, error }` (see `gym-crud.ts`).
- Tests use Vitest globals, `testPrisma` + `resetDb()` from `tests/helpers/db.ts`, real test DB via `DATABASE_URL_TEST`.
- `FitnessProgram`/`FitnessExercise` are NOT added to `TENANT_SCOPED_MODELS` — scope manually with explicit `tenantId`/`gymId` in `where`, same as `TenantInvoice`.
- Dark theme Tailwind: `bg-slate-950`, `bg-slate-900`, `border-slate-800`, `text-slate-100`.
- `repsOrDurationSec` convention: value `< 100` = repetitions, value `>= 100` = seconds.

---

## Task 1: Fitness utility functions (pure, TDD)

**Files:**
- Create: `src/lib/fitness-utils.ts`
- Test: `tests/lib/fitness-utils.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/fitness-utils.test.ts
import { describe, it, expect } from "vitest";
import {
  currentWeek,
  weekTargetWeight,
  walkCalories,
  WALK_KCAL_PER_MIN,
} from "@/lib/fitness-utils";

describe("currentWeek", () => {
  it("returns 1 on the start date", () => {
    const start = new Date("2026-06-01T08:00:00Z");
    const now = new Date("2026-06-01T20:00:00Z");
    expect(currentWeek(start, now, 8)).toBe(1);
  });
  it("returns 2 after 7 days", () => {
    const start = new Date("2026-06-01T00:00:00Z");
    const now = new Date("2026-06-08T00:00:00Z");
    expect(currentWeek(start, now, 8)).toBe(2);
  });
  it("caps at total weeks", () => {
    const start = new Date("2026-06-01T00:00:00Z");
    const now = new Date("2026-12-01T00:00:00Z");
    expect(currentWeek(start, now, 8)).toBe(8);
  });
  it("never returns less than 1", () => {
    const start = new Date("2026-06-10T00:00:00Z");
    const now = new Date("2026-06-01T00:00:00Z");
    expect(currentWeek(start, now, 8)).toBe(1);
  });
});

describe("weekTargetWeight", () => {
  it("returns start weight at week 0", () => {
    expect(weekTargetWeight(92, 85, 0, 8)).toBe(92);
  });
  it("returns goal weight at final week", () => {
    expect(weekTargetWeight(92, 85, 8, 8)).toBe(85);
  });
  it("interpolates linearly at the midpoint", () => {
    expect(weekTargetWeight(92, 85, 4, 8)).toBeCloseTo(88.5, 1);
  });
});

describe("walkCalories", () => {
  it("uses 8.5 kcal/min", () => {
    expect(WALK_KCAL_PER_MIN).toBe(8.5);
    expect(walkCalories(30)).toBe(255);
  });
  it("rounds to nearest integer", () => {
    expect(walkCalories(10.4)).toBe(88);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/lib/fitness-utils.test.ts`
Expected: FAIL — `Cannot find module '@/lib/fitness-utils'`

- [ ] **Step 3: Implement**

```ts
// src/lib/fitness-utils.ts
export const WALK_KCAL_PER_MIN = 8.5;

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/** 1-based program week, clamped to [1, totalWeeks]. */
export function currentWeek(startDate: Date, now: Date, totalWeeks: number): number {
  const diff = now.getTime() - startDate.getTime();
  const week = Math.floor(diff / MS_PER_WEEK) + 1;
  if (week < 1) return 1;
  if (week > totalWeeks) return totalWeeks;
  return week;
}

/** Linear interpolation of target weight at a given week. */
export function weekTargetWeight(
  startWeight: number,
  goalWeight: number,
  week: number,
  totalWeeks: number,
): number {
  if (totalWeeks <= 0) return startWeight;
  return startWeight - (startWeight - goalWeight) * (week / totalWeeks);
}

/** Estimated kcal for a walking session of `minutes`, rounded. */
export function walkCalories(minutes: number): number {
  return Math.round(minutes * WALK_KCAL_PER_MIN);
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run tests/lib/fitness-utils.test.ts`
Expected: PASS (4 + 3 + 2 assertions green)

- [ ] **Step 5: Commit**

```bash
git add src/lib/fitness-utils.ts tests/lib/fitness-utils.test.ts
git commit -m "feat(fitness): add week/weight/calorie utility functions"
```

---

## Task 2: Prisma schema — fitness models + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `tests/helpers/db.ts`

- [ ] **Step 1: Add enum + models to `prisma/schema.prisma`**

Append at the end of the file:

```prisma
enum FitnessProgramType {
  FULL_BODY
  GAINAGE_ABDOS
  JAMBES_FESSIERS
  HAUT_CORPS
  CUSTOM
}

model FitnessProgram {
  id          String             @id @default(cuid())
  tenantId    String
  gymId       String
  createdById String?            // null = gym/manager program | userId = member-private program
  name        String
  color       String             @default("#C8FF00")
  type        FitnessProgramType @default(CUSTOM)
  isActive    Boolean            @default(true)
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt

  tenant    Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  gym       Gym               @relation(fields: [gymId], references: [id], onDelete: Cascade)
  createdBy User?             @relation("MemberFitnessPrograms", fields: [createdById], references: [id], onDelete: SetNull)
  exercises FitnessExercise[]

  @@index([tenantId])
  @@index([gymId])
  @@index([createdById])
}

model FitnessExercise {
  id                String   @id @default(cuid())
  programId         String
  tenantId          String
  name              String
  sets              Int
  repsOrDurationSec Int      // < 100 = reps, >= 100 = seconds
  recoverySec       Int      @default(60)
  muscles           String
  steps             Json     // string[]
  tip               String?
  order             Int      @default(0)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  program FitnessProgram @relation(fields: [programId], references: [id], onDelete: Cascade)
  tenant  Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([programId])
  @@index([tenantId])
}
```

- [ ] **Step 2: Add back-relations to existing models**

In `model Tenant { ... }` add to the relations block:
```prisma
  fitnessPrograms       FitnessProgram[]
  fitnessExercises      FitnessExercise[]
```

In `model Gym { ... }` add:
```prisma
  fitnessPrograms FitnessProgram[]
```

In `model User { ... }` add:
```prisma
  fitnessPrograms          FitnessProgram[] @relation("MemberFitnessPrograms")
```

- [ ] **Step 3: Create migration**

Run: `npm run db:migrate -- --name add_fitness_programs`
Expected: migration created + applied to dev DB, Prisma client regenerated.

- [ ] **Step 4: Apply migration to test DB**

Run: `DATABASE_URL=$DATABASE_URL_TEST npx prisma migrate deploy`
Expected: "All migrations have been successfully applied."

- [ ] **Step 5: Update `resetDb()` in `tests/helpers/db.ts`**

Add these two lines at the TOP of the delete sequence in `resetDb()` (before `paymentIntent.deleteMany()`), because exercises/programs reference tenant/gym/user:

```ts
  await testPrisma.fitnessExercise.deleteMany();
  await testPrisma.fitnessProgram.deleteMany();
```

- [ ] **Step 6: Verify schema compiles + existing tests still pass**

Run: `npm run typecheck && npx vitest run tests/lib/prisma-tenant.test.ts`
Expected: no type errors, prisma-tenant test PASS.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations tests/helpers/db.ts
git commit -m "feat(fitness): add FitnessProgram + FitnessExercise schema"
```

---

## Task 3: Default program data + types

**Files:**
- Create: `src/components/member/fitness/types.ts`
- Create: `src/lib/fitness-defaults.ts`

- [ ] **Step 1: Create shared types**

```ts
// src/components/member/fitness/types.ts
import type { FitnessProgramType } from "@prisma/client";

export interface ExerciseDTO {
  id: string;
  name: string;
  sets: number;
  repsOrDurationSec: number; // < 100 reps, >= 100 seconds
  recoverySec: number;
  muscles: string;
  steps: string[];
  tip: string | null;
  order: number;
}

export interface ProgramDTO {
  id: string;
  name: string;
  color: string;
  type: FitnessProgramType;
  createdById: string | null; // null = gym program
  exercises: ExerciseDTO[];
}

export type DayType = "course" | "fractional" | "muscu" | "marche" | "yoga" | "repos";

export interface WeekDay {
  type: DayType;
  label: string;
  durationMin: number | null;
  done: boolean;
}

export interface FitProfile {
  startWeightKg: number;
  goalWeightKg: number;
  durationWeeks: 4 | 8 | 12;
  startDate: string; // ISO
}

export interface WeightEntry { date: string; weightKg: number }
export interface SleepEntry { date: string; hours: number }
export interface SessionEntry {
  date: string;
  programId: string;
  programName: string;
  durationMin: number;
}

export interface FitAppData {
  profile: FitProfile | null;
  weekData: WeekDay[][]; // [weekIndex][0..6] Mon..Sun
  weights: WeightEntry[];
  sleeps: SleepEntry[];
  sessions: SessionEntry[];
}
```

- [ ] **Step 2: Create default program + schedule data**

`DAY_ICONS`, `WEEKLY_SCHEDULE` (Mon..Sun), `WEEK_CALORIES` table, and `DEFAULT_PROGRAMS` (the 4 seeded programs). Exercise input type matches the seed args in Task 4.

```ts
// src/lib/fitness-defaults.ts
import type { FitnessProgramType } from "@prisma/client";

export const DAY_ICONS: Record<string, string> = {
  course: "🏃",
  fractional: "⚡",
  muscu: "💪",
  marche: "🚶",
  yoga: "🧘",
  repos: "😴",
};

export interface ScheduleDay {
  type: keyof typeof DAY_ICONS;
  label: string;
  durationMin: number | null;
}

// Mon..Sun
export const WEEKLY_SCHEDULE: ScheduleDay[] = [
  { type: "muscu", label: "Full Body", durationMin: 40 },
  { type: "marche", label: "Marche Japonaise", durationMin: 30 },
  { type: "muscu", label: "Gainage & Abdos", durationMin: 35 },
  { type: "repos", label: "Repos", durationMin: null },
  { type: "muscu", label: "Jambes & Fessiers", durationMin: 40 },
  { type: "course", label: "Course", durationMin: 30 },
  { type: "yoga", label: "Yoga / Étirements", durationMin: 20 },
];

/** Daily calorie target by week index (1-based). Falls back to last value. */
export const WEEK_CALORIES = [2100, 2000, 2000, 1950, 1900, 1900, 1850, 1900];
export function weekCalories(week: number): number {
  return WEEK_CALORIES[Math.min(week, WEEK_CALORIES.length) - 1] ?? WEEK_CALORIES[WEEK_CALORIES.length - 1];
}

export interface SeedExercise {
  name: string;
  sets: number;
  repsOrDurationSec: number;
  recoverySec: number;
  muscles: string;
  steps: string[];
  tip: string;
}

export interface SeedProgram {
  name: string;
  color: string;
  type: FitnessProgramType;
  exercises: SeedExercise[];
}

export const DEFAULT_PROGRAMS: SeedProgram[] = [
  {
    name: "Full Body",
    color: "#C8FF00",
    type: "FULL_BODY",
    exercises: [
      { name: "Squat", sets: 3, repsOrDurationSec: 15, recoverySec: 60, muscles: "Quadriceps, Fessiers", steps: ["Pieds largeur épaules", "Dos droit", "Descends comme pour t'asseoir", "Cuisses parallèles au sol", "Remonte en poussant sur les talons"], tip: "Genoux alignés avec les pieds." },
      { name: "Pompes", sets: 3, repsOrDurationSec: 12, recoverySec: 60, muscles: "Pectoraux, Triceps", steps: ["Mains largeur épaules", "Corps gainé", "Descends la poitrine vers le sol", "Coudes à 45°", "Pousse pour remonter"], tip: "Garde le corps en ligne droite." },
      { name: "Fentes alternées", sets: 3, repsOrDurationSec: 12, recoverySec: 60, muscles: "Quadriceps, Fessiers", steps: ["Debout droit", "Grand pas en avant", "Descends le genou arrière", "Genou avant à 90°", "Reviens et alterne"], tip: "Buste droit pendant la descente." },
      { name: "Rowing sous table", sets: 3, repsOrDurationSec: 12, recoverySec: 60, muscles: "Dos, Biceps", steps: ["Allongé sous une table solide", "Saisis le bord", "Corps gainé", "Tire la poitrine vers la table", "Redescends lentement"], tip: "Serre les omoplates en haut." },
      { name: "Pike Push-up", sets: 3, repsOrDurationSec: 10, recoverySec: 60, muscles: "Épaules", steps: ["Position en V inversé", "Mains au sol", "Descends la tête vers le sol", "Coudes vers l'arrière", "Pousse pour remonter"], tip: "Hanches hautes pour cibler les épaules." },
      { name: "Planche frontale", sets: 3, repsOrDurationSec: 45, recoverySec: 60, muscles: "Abdos, Gainage", steps: ["Appui sur avant-bras", "Corps gainé", "Dos plat", "Contracte les abdos", "Tiens la position"], tip: "Ne creuse pas le bas du dos." },
    ],
  },
  {
    name: "Gainage & Abdos",
    color: "#FF6B35",
    type: "GAINAGE_ABDOS",
    exercises: [
      { name: "Planche frontale", sets: 3, repsOrDurationSec: 45, recoverySec: 45, muscles: "Abdos, Gainage", steps: ["Appui avant-bras", "Corps gainé", "Dos plat", "Contracte les abdos", "Tiens la position"], tip: "Respire régulièrement." },
      { name: "Planche latérale", sets: 3, repsOrDurationSec: 30, recoverySec: 45, muscles: "Obliques", steps: ["Appui sur un avant-bras", "Corps sur le côté", "Hanches hautes", "Aligne épaule-hanche-pied", "Tiens puis change de côté"], tip: "Ne laisse pas les hanches tomber." },
      { name: "Crunch Bicycle", sets: 3, repsOrDurationSec: 20, recoverySec: 45, muscles: "Abdos, Obliques", steps: ["Allongé sur le dos", "Mains derrière la tête", "Pédale dans le vide", "Coude vers genou opposé", "Alterne en rythme"], tip: "Ne tire pas sur la nuque." },
      { name: "Mountain Climbers", sets: 3, repsOrDurationSec: 30, recoverySec: 45, muscles: "Abdos, Cardio", steps: ["Position de pompe", "Corps gainé", "Ramène un genou vers la poitrine", "Alterne rapidement", "Garde le bassin stable"], tip: "Rythme rapide mais contrôlé." },
      { name: "Dead Bug", sets: 3, repsOrDurationSec: 12, recoverySec: 45, muscles: "Abdos profonds", steps: ["Allongé sur le dos", "Bras tendus vers le plafond", "Genoux à 90°", "Descends bras + jambe opposés", "Reviens et alterne"], tip: "Plaque le bas du dos au sol." },
      { name: "Relevés de jambes", sets: 3, repsOrDurationSec: 12, recoverySec: 45, muscles: "Abdos inférieurs", steps: ["Allongé sur le dos", "Jambes tendues", "Mains sous les fessiers", "Lève les jambes à la verticale", "Redescends sans toucher le sol"], tip: "Contrôle la descente." },
    ],
  },
  {
    name: "Jambes & Fessiers",
    color: "#4FC3F7",
    type: "JAMBES_FESSIERS",
    exercises: [
      { name: "Squat bulgare", sets: 3, repsOrDurationSec: 12, recoverySec: 60, muscles: "Quadriceps, Fessiers", steps: ["Pied arrière surélevé", "Buste droit", "Descends sur la jambe avant", "Genou à 90°", "Remonte en poussant"], tip: "Le poids sur le talon avant." },
      { name: "Hip Thrust", sets: 3, repsOrDurationSec: 15, recoverySec: 60, muscles: "Fessiers", steps: ["Dos appuyé sur un canapé", "Pieds au sol", "Pousse les hanches vers le haut", "Contracte les fessiers en haut", "Redescends lentement"], tip: "Menton rentré, regard vers l'avant." },
      { name: "Fente latérale", sets: 3, repsOrDurationSec: 12, recoverySec: 60, muscles: "Adducteurs, Fessiers", steps: ["Debout jambes écartées", "Grand pas sur le côté", "Plie une jambe", "Autre jambe tendue", "Reviens et alterne"], tip: "Garde le dos droit." },
      { name: "Soulevé roumain", sets: 3, repsOrDurationSec: 12, recoverySec: 60, muscles: "Ischios, Fessiers", steps: ["Debout, jambes semi-fléchies", "Penche le buste en avant", "Dos plat", "Descends en gardant les jambes tendues", "Remonte en contractant les fessiers"], tip: "Ne courbe jamais le dos." },
      { name: "Élévations de mollets", sets: 3, repsOrDurationSec: 20, recoverySec: 45, muscles: "Mollets", steps: ["Debout", "Sur la pointe des pieds", "Monte le plus haut possible", "Pause en haut", "Redescends lentement"], tip: "Amplitude complète." },
      { name: "Planche latérale dynamique", sets: 3, repsOrDurationSec: 30, recoverySec: 45, muscles: "Obliques, Fessiers", steps: ["Planche latérale", "Hanche basse vers le sol", "Remonte la hanche", "Mouvement contrôlé", "Change de côté"], tip: "Garde l'alignement du corps." },
    ],
  },
  {
    name: "Haut du Corps",
    color: "#CE93D8",
    type: "HAUT_CORPS",
    exercises: [
      { name: "Pompes larges", sets: 3, repsOrDurationSec: 12, recoverySec: 60, muscles: "Pectoraux", steps: ["Mains plus larges que les épaules", "Corps gainé", "Descends la poitrine", "Coudes vers l'extérieur", "Pousse pour remonter"], tip: "Contrôle la descente." },
      { name: "Dips aux chaises", sets: 3, repsOrDurationSec: 10, recoverySec: 60, muscles: "Triceps", steps: ["Mains sur deux chaises", "Jambes tendues devant", "Descends en pliant les coudes", "Coudes vers l'arrière", "Remonte en poussant"], tip: "Épaules basses, loin des oreilles." },
      { name: "Curl bouteilles d'eau", sets: 3, repsOrDurationSec: 15, recoverySec: 45, muscles: "Biceps", steps: ["Une bouteille dans chaque main", "Bras le long du corps", "Plie les coudes", "Monte vers les épaules", "Redescends lentement"], tip: "Coudes fixes le long du corps." },
      { name: "Rowing sous table", sets: 3, repsOrDurationSec: 12, recoverySec: 60, muscles: "Dos, Biceps", steps: ["Allongé sous une table", "Saisis le bord", "Corps gainé", "Tire la poitrine vers le haut", "Redescends lentement"], tip: "Serre les omoplates." },
      { name: "Cercles de bras lestés", sets: 3, repsOrDurationSec: 30, recoverySec: 45, muscles: "Épaules", steps: ["Une bouteille dans chaque main", "Bras tendus sur les côtés", "Petits cercles", "Sens horaire puis anti-horaire", "Garde les bras à l'horizontale"], tip: "Mouvement lent et contrôlé." },
      { name: "Superman", sets: 3, repsOrDurationSec: 15, recoverySec: 45, muscles: "Dos, Lombaires", steps: ["Allongé sur le ventre", "Bras tendus devant", "Lève bras et jambes simultanément", "Contracte le dos", "Redescends lentement"], tip: "Regard vers le sol, nuque neutre." },
    ],
  },
];
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/member/fitness/types.ts src/lib/fitness-defaults.ts
git commit -m "feat(fitness): add shared types + default program data"
```

---

## Task 4: Seed default programs for a gym (TDD)

**Files:**
- Create: `src/lib/fitness-seed.ts`
- Test: `tests/lib/fitness-seed.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/fitness-seed.test.ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, resetDb } from "../helpers/db";
import { seedDefaultFitnessPrograms } from "@/lib/fitness-seed";
import { TenantStatus } from "@prisma/client";

async function seedGym() {
  const tenant = await testPrisma.tenant.create({
    data: { name: "T", slug: `t-${Date.now()}-${Math.random()}`, ownerEmail: "a@x.com", ownerPhone: "1", city: "Dakar", status: TenantStatus.ACTIVE },
  });
  const gym = await testPrisma.gym.create({
    data: { tenantId: tenant.id, name: "G", address: "x", city: "Dakar", phone: "1", latitude: 14.7, longitude: -17.4 },
  });
  return { tenant, gym };
}

describe("seedDefaultFitnessPrograms", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("creates 4 gym programs with createdById null", async () => {
    const { tenant, gym } = await seedGym();
    await seedDefaultFitnessPrograms({ tenantId: tenant.id, gymId: gym.id, prisma: testPrisma });
    const programs = await testPrisma.fitnessProgram.findMany({ where: { gymId: gym.id } });
    expect(programs).toHaveLength(4);
    expect(programs.every((p) => p.createdById === null)).toBe(true);
  });

  it("creates 6 exercises per program", async () => {
    const { tenant, gym } = await seedGym();
    await seedDefaultFitnessPrograms({ tenantId: tenant.id, gymId: gym.id, prisma: testPrisma });
    const exercises = await testPrisma.fitnessExercise.findMany();
    expect(exercises).toHaveLength(24);
  });

  it("is idempotent — does not duplicate on second call", async () => {
    const { tenant, gym } = await seedGym();
    await seedDefaultFitnessPrograms({ tenantId: tenant.id, gymId: gym.id, prisma: testPrisma });
    await seedDefaultFitnessPrograms({ tenantId: tenant.id, gymId: gym.id, prisma: testPrisma });
    const programs = await testPrisma.fitnessProgram.findMany({ where: { gymId: gym.id } });
    expect(programs).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run, verify fails**

Run: `npx vitest run tests/lib/fitness-seed.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/fitness-seed.ts
import { PrismaClient } from "@prisma/client";
import { DEFAULT_PROGRAMS } from "@/lib/fitness-defaults";

export async function seedDefaultFitnessPrograms(args: {
  tenantId: string;
  gymId: string;
  prisma: PrismaClient;
}): Promise<void> {
  const { tenantId, gymId, prisma } = args;

  // Idempotency: skip gyms that already have default (manager/gym) programs.
  const existing = await prisma.fitnessProgram.count({
    where: { gymId, createdById: null },
  });
  if (existing > 0) return;

  for (const program of DEFAULT_PROGRAMS) {
    await prisma.fitnessProgram.create({
      data: {
        tenantId,
        gymId,
        createdById: null,
        name: program.name,
        color: program.color,
        type: program.type,
        exercises: {
          create: program.exercises.map((ex, idx) => ({
            tenantId,
            name: ex.name,
            sets: ex.sets,
            repsOrDurationSec: ex.repsOrDurationSec,
            recoverySec: ex.recoverySec,
            muscles: ex.muscles,
            steps: ex.steps,
            tip: ex.tip,
            order: idx,
          })),
        },
      },
    });
  }
}
```

- [ ] **Step 4: Run, verify passes**

Run: `npx vitest run tests/lib/fitness-seed.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/fitness-seed.ts tests/lib/fitness-seed.test.ts
git commit -m "feat(fitness): seed 4 default programs per gym (idempotent)"
```

---

## Task 5: Program + exercise CRUD server actions (TDD)

Single module handles both manager (gym programs, `createdById = null`) and member (private programs, `createdById = userId`). Ownership rules enforced in every mutating action.

**Files:**
- Create: `src/lib/server-actions/fitness-program-crud.ts`
- Test: `tests/lib/server-actions/fitness-program-crud.test.ts`

**Action signatures (all take injected `prisma`, return `{ success, data?/error? }`):**

```ts
listPrograms({ tenantId, gymId, memberId?, prisma })
  // memberId given → gym programs + that member's private. omitted → gym programs only (manager view).
createProgram({ tenantId, gymId, createdById, name, color, type, prisma })
updateProgram({ id, tenantId, actorId, isManager, name?, color?, type?, isActive?, prisma })
deleteProgram({ id, tenantId, actorId, isManager, prisma })
addExercise({ programId, tenantId, actorId, isManager, ...exerciseFields, prisma })
updateExercise({ id, tenantId, actorId, isManager, ...fields, prisma })
deleteExercise({ id, tenantId, actorId, isManager, prisma })
```

**Ownership rule** (used by every mutating action): load the target program; allow if `isManager && program.createdById === null` (gym program) OR `program.createdById === actorId` (own private program). Otherwise `{ success: false, error: "FORBIDDEN" }`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/server-actions/fitness-program-crud.test.ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, resetDb } from "../../helpers/db";
import {
  listPrograms, createProgram, updateProgram, deleteProgram,
  addExercise, updateExercise, deleteExercise,
} from "@/lib/server-actions/fitness-program-crud";
import { Role, TenantStatus } from "@prisma/client";

async function seed() {
  const tenant = await testPrisma.tenant.create({
    data: { name: "T", slug: `t-${Date.now()}-${Math.random()}`, ownerEmail: "a@x.com", ownerPhone: "1", city: "Dakar", status: TenantStatus.ACTIVE },
  });
  const gym = await testPrisma.gym.create({
    data: { tenantId: tenant.id, name: "G", address: "x", city: "Dakar", phone: "1", latitude: 14.7, longitude: -17.4 },
  });
  const member = await testPrisma.user.create({
    data: { name: "M", role: Role.MEMBER, tenantId: tenant.id, gymId: gym.id },
  });
  const other = await testPrisma.user.create({
    data: { name: "O", role: Role.MEMBER, tenantId: tenant.id, gymId: gym.id },
  });
  return { tenant, gym, member, other };
}

const exFields = { name: "Squat", sets: 3, repsOrDurationSec: 15, recoverySec: 60, muscles: "Jambes", steps: ["a", "b"], tip: "ok" };

describe("createProgram + listPrograms", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("manager creates a gym program (createdById null)", async () => {
    const { tenant, gym } = await seed();
    const r = await createProgram({ tenantId: tenant.id, gymId: gym.id, createdById: null, name: "P", color: "#fff", type: "CUSTOM", prisma: testPrisma });
    expect(r.success).toBe(true);
    const list = await listPrograms({ tenantId: tenant.id, gymId: gym.id, prisma: testPrisma });
    expect(list.success && list.data).toHaveLength(1);
  });

  it("member sees gym programs + own private but NOT others' private", async () => {
    const { tenant, gym, member, other } = await seed();
    await createProgram({ tenantId: tenant.id, gymId: gym.id, createdById: null, name: "Gym", color: "#fff", type: "CUSTOM", prisma: testPrisma });
    await createProgram({ tenantId: tenant.id, gymId: gym.id, createdById: member.id, name: "Mine", color: "#fff", type: "CUSTOM", prisma: testPrisma });
    await createProgram({ tenantId: tenant.id, gymId: gym.id, createdById: other.id, name: "Theirs", color: "#fff", type: "CUSTOM", prisma: testPrisma });
    const list = await listPrograms({ tenantId: tenant.id, gymId: gym.id, memberId: member.id, prisma: testPrisma });
    const names = list.success ? list.data.map((p) => p.name).sort() : [];
    expect(names).toEqual(["Gym", "Mine"]);
  });
});

describe("ownership on update/delete", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("member cannot edit a gym program", async () => {
    const { tenant, gym, member } = await seed();
    const c = await createProgram({ tenantId: tenant.id, gymId: gym.id, createdById: null, name: "Gym", color: "#fff", type: "CUSTOM", prisma: testPrisma });
    const id = c.success ? c.data.id : "";
    const r = await updateProgram({ id, tenantId: tenant.id, actorId: member.id, isManager: false, name: "Hack", prisma: testPrisma });
    expect(r.success).toBe(false);
    expect(!r.success && r.error).toBe("FORBIDDEN");
  });

  it("member cannot edit another member's private program", async () => {
    const { tenant, gym, member, other } = await seed();
    const c = await createProgram({ tenantId: tenant.id, gymId: gym.id, createdById: other.id, name: "Theirs", color: "#fff", type: "CUSTOM", prisma: testPrisma });
    const id = c.success ? c.data.id : "";
    const r = await deleteProgram({ id, tenantId: tenant.id, actorId: member.id, isManager: false, prisma: testPrisma });
    expect(!r.success && r.error).toBe("FORBIDDEN");
  });

  it("member edits own private program", async () => {
    const { tenant, gym, member } = await seed();
    const c = await createProgram({ tenantId: tenant.id, gymId: gym.id, createdById: member.id, name: "Mine", color: "#fff", type: "CUSTOM", prisma: testPrisma });
    const id = c.success ? c.data.id : "";
    const r = await updateProgram({ id, tenantId: tenant.id, actorId: member.id, isManager: false, name: "Mine2", prisma: testPrisma });
    expect(r.success).toBe(true);
  });

  it("manager edits a gym program", async () => {
    const { tenant, gym } = await seed();
    const c = await createProgram({ tenantId: tenant.id, gymId: gym.id, createdById: null, name: "Gym", color: "#fff", type: "CUSTOM", prisma: testPrisma });
    const id = c.success ? c.data.id : "";
    const r = await updateProgram({ id, tenantId: tenant.id, actorId: "mgr", isManager: true, name: "Gym2", prisma: testPrisma });
    expect(r.success).toBe(true);
  });
});

describe("exercise CRUD", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("adds, updates, deletes an exercise on own program", async () => {
    const { tenant, gym, member } = await seed();
    const c = await createProgram({ tenantId: tenant.id, gymId: gym.id, createdById: member.id, name: "Mine", color: "#fff", type: "CUSTOM", prisma: testPrisma });
    const programId = c.success ? c.data.id : "";
    const add = await addExercise({ programId, tenantId: tenant.id, actorId: member.id, isManager: false, ...exFields, prisma: testPrisma });
    expect(add.success).toBe(true);
    const exId = add.success ? add.data.id : "";
    const upd = await updateExercise({ id: exId, tenantId: tenant.id, actorId: member.id, isManager: false, name: "Squat2", prisma: testPrisma });
    expect(upd.success).toBe(true);
    const del = await deleteExercise({ id: exId, tenantId: tenant.id, actorId: member.id, isManager: false, prisma: testPrisma });
    expect(del.success).toBe(true);
    const left = await testPrisma.fitnessExercise.count({ where: { programId } });
    expect(left).toBe(0);
  });

  it("blocks adding an exercise to a gym program as member", async () => {
    const { tenant, gym, member } = await seed();
    const c = await createProgram({ tenantId: tenant.id, gymId: gym.id, createdById: null, name: "Gym", color: "#fff", type: "CUSTOM", prisma: testPrisma });
    const programId = c.success ? c.data.id : "";
    const add = await addExercise({ programId, tenantId: tenant.id, actorId: member.id, isManager: false, ...exFields, prisma: testPrisma });
    expect(!add.success && add.error).toBe("FORBIDDEN");
  });
});
```

- [ ] **Step 2: Run, verify fails**

Run: `npx vitest run tests/lib/server-actions/fitness-program-crud.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** (see next task block for the full file — write it now)

Create `src/lib/server-actions/fitness-program-crud.ts` with the code in Task 5b below.

- [ ] **Step 4: Run, verify passes**

Run: `npx vitest run tests/lib/server-actions/fitness-program-crud.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server-actions/fitness-program-crud.ts tests/lib/server-actions/fitness-program-crud.test.ts
git commit -m "feat(fitness): program + exercise CRUD server actions with ownership"
```

---

## Task 5b: Full `fitness-program-crud.ts` implementation

This is the code referenced in Task 5 Step 3. Write the entire file:

```ts
// src/lib/server-actions/fitness-program-crud.ts
import { PrismaClient, FitnessProgramType } from "@prisma/client";

type Result<T> = { success: true; data: T } | { success: false; error: string };

interface ExerciseInput {
  name: string;
  sets: number;
  repsOrDurationSec: number;
  recoverySec: number;
  muscles: string;
  steps: string[];
  tip?: string | null;
}

// Allow if manager editing a gym program, or member editing own private program.
async function assertCanEdit(
  prisma: PrismaClient,
  programId: string,
  tenantId: string,
  actorId: string,
  isManager: boolean,
): Promise<Result<{ createdById: string | null }>> {
  const program = await prisma.fitnessProgram.findFirst({
    where: { id: programId, tenantId },
    select: { createdById: true },
  });
  if (!program) return { success: false, error: "NOT_FOUND" };
  const allowed =
    (isManager && program.createdById === null) || program.createdById === actorId;
  if (!allowed) return { success: false, error: "FORBIDDEN" };
  return { success: true, data: program };
}

export async function listPrograms(args: {
  tenantId: string;
  gymId: string;
  memberId?: string;
  prisma: PrismaClient;
}) {
  const { tenantId, gymId, memberId, prisma } = args;
  const where = memberId
    ? { tenantId, gymId, isActive: true, OR: [{ createdById: null }, { createdById: memberId }] }
    : { tenantId, gymId, createdById: null };
  const data = await prisma.fitnessProgram.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: { exercises: { orderBy: { order: "asc" } } },
  });
  return { success: true as const, data };
}

export async function createProgram(args: {
  tenantId: string;
  gymId: string;
  createdById: string | null;
  name: string;
  color: string;
  type: FitnessProgramType;
  prisma: PrismaClient;
}) {
  const { tenantId, gymId, createdById, name, color, type, prisma } = args;
  if (!name.trim()) return { success: false as const, error: "NAME_REQUIRED" };
  const data = await prisma.fitnessProgram.create({
    data: { tenantId, gymId, createdById, name: name.trim(), color, type },
  });
  return { success: true as const, data };
}

export async function updateProgram(args: {
  id: string;
  tenantId: string;
  actorId: string;
  isManager: boolean;
  name?: string;
  color?: string;
  type?: FitnessProgramType;
  isActive?: boolean;
  prisma: PrismaClient;
}) {
  const { id, tenantId, actorId, isManager, prisma, ...fields } = args;
  const can = await assertCanEdit(prisma, id, tenantId, actorId, isManager);
  if (!can.success) return can;
  const data = await prisma.fitnessProgram.update({
    where: { id },
    data: {
      ...(fields.name !== undefined ? { name: fields.name } : {}),
      ...(fields.color !== undefined ? { color: fields.color } : {}),
      ...(fields.type !== undefined ? { type: fields.type } : {}),
      ...(fields.isActive !== undefined ? { isActive: fields.isActive } : {}),
    },
  });
  return { success: true as const, data };
}

export async function deleteProgram(args: {
  id: string;
  tenantId: string;
  actorId: string;
  isManager: boolean;
  prisma: PrismaClient;
}) {
  const { id, tenantId, actorId, isManager, prisma } = args;
  const can = await assertCanEdit(prisma, id, tenantId, actorId, isManager);
  if (!can.success) return can;
  await prisma.fitnessProgram.delete({ where: { id } });
  return { success: true as const, data: { id } };
}

export async function addExercise(args: {
  programId: string;
  tenantId: string;
  actorId: string;
  isManager: boolean;
  prisma: PrismaClient;
} & ExerciseInput) {
  const { programId, tenantId, actorId, isManager, prisma, ...ex } = args;
  const can = await assertCanEdit(prisma, programId, tenantId, actorId, isManager);
  if (!can.success) return can;
  const count = await prisma.fitnessExercise.count({ where: { programId } });
  const data = await prisma.fitnessExercise.create({
    data: {
      programId,
      tenantId,
      name: ex.name,
      sets: ex.sets,
      repsOrDurationSec: ex.repsOrDurationSec,
      recoverySec: ex.recoverySec,
      muscles: ex.muscles,
      steps: ex.steps,
      tip: ex.tip ?? null,
      order: count,
    },
  });
  return { success: true as const, data };
}

export async function updateExercise(args: {
  id: string;
  tenantId: string;
  actorId: string;
  isManager: boolean;
  prisma: PrismaClient;
} & Partial<ExerciseInput>) {
  const { id, tenantId, actorId, isManager, prisma, ...fields } = args;
  const exercise = await prisma.fitnessExercise.findFirst({
    where: { id, tenantId },
    select: { programId: true },
  });
  if (!exercise) return { success: false as const, error: "NOT_FOUND" };
  const can = await assertCanEdit(prisma, exercise.programId, tenantId, actorId, isManager);
  if (!can.success) return can;
  const data = await prisma.fitnessExercise.update({
    where: { id },
    data: {
      ...(fields.name !== undefined ? { name: fields.name } : {}),
      ...(fields.sets !== undefined ? { sets: fields.sets } : {}),
      ...(fields.repsOrDurationSec !== undefined ? { repsOrDurationSec: fields.repsOrDurationSec } : {}),
      ...(fields.recoverySec !== undefined ? { recoverySec: fields.recoverySec } : {}),
      ...(fields.muscles !== undefined ? { muscles: fields.muscles } : {}),
      ...(fields.steps !== undefined ? { steps: fields.steps } : {}),
      ...(fields.tip !== undefined ? { tip: fields.tip } : {}),
    },
  });
  return { success: true as const, data };
}

export async function deleteExercise(args: {
  id: string;
  tenantId: string;
  actorId: string;
  isManager: boolean;
  prisma: PrismaClient;
}) {
  const { id, tenantId, actorId, isManager, prisma } = args;
  const exercise = await prisma.fitnessExercise.findFirst({
    where: { id, tenantId },
    select: { programId: true },
  });
  if (!exercise) return { success: false as const, error: "NOT_FOUND" };
  const can = await assertCanEdit(prisma, exercise.programId, tenantId, actorId, isManager);
  if (!can.success) return can;
  await prisma.fitnessExercise.delete({ where: { id } });
  return { success: true as const, data: { id } };
}
```

---

## Task 6: Seed on gym creation + member API route

**Files:**
- Modify: `src/lib/server-actions/gym-crud.ts`
- Create: `src/app/api/me/fitness/programs/route.ts`

- [ ] **Step 1: Hook seed into `createGym`**

Open `src/lib/server-actions/gym-crud.ts`. Find where `createGym` creates the gym and returns success. Immediately after the gym is created (and before returning success), add:

```ts
import { seedDefaultFitnessPrograms } from "@/lib/fitness-seed";

// ... inside createGym, after `const gym = await prisma.gym.create({ ... });`
await seedDefaultFitnessPrograms({ tenantId: gym.tenantId, gymId: gym.id, prisma });
```

If `createGym` uses `tenantPrisma`/scoped client for the create, pass the same base `prisma` to the seed (seed uses explicit tenantId so base client is fine).

- [ ] **Step 2: Verify gym-crud test still passes**

Run: `npx vitest run tests/lib/server-actions/gym-crud.test.ts`
Expected: PASS. (Seed runs but does not affect gym assertions.)

- [ ] **Step 3: Add an assertion that gym creation seeds programs**

In `tests/lib/server-actions/gym-crud.test.ts`, inside the existing `describe("createGym", ...)`, add:

```ts
  it("seeds 4 default fitness programs", async () => {
    const t = await seedTenant();
    const r = await createGym({ tenantId: t.id, ...validInput, prisma: testPrisma });
    expect(r.success).toBe(true);
    const gym = (await testPrisma.gym.findFirst({ where: { tenantId: t.id } }))!;
    const programs = await testPrisma.fitnessProgram.findMany({ where: { gymId: gym.id } });
    expect(programs).toHaveLength(4);
  });
```

Run: `npx vitest run tests/lib/server-actions/gym-crud.test.ts`
Expected: PASS including the new test.

- [ ] **Step 4: Create member API route**

```ts
// src/app/api/me/fitness/programs/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { authMobileRequest } from "@/lib/mobile-auth-context";
import { listPrograms } from "@/lib/server-actions/fitness-program-crud";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Web session first, then mobile bearer.
  const ctx = await getCurrentAuthContext();
  let userId = ctx?.userId;
  let tenantId = ctx?.tenantId ?? null;
  let gymId = ctx?.gymId ?? null;

  if (!userId) {
    const mobile = await authMobileRequest(req);
    if (!mobile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const u = await prisma.user.findUnique({
      where: { id: mobile.userId },
      select: { id: true, tenantId: true, gymId: true },
    });
    if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    userId = u.id; tenantId = u.tenantId; gymId = u.gymId;
  }

  if (!tenantId || !gymId) return NextResponse.json({ error: "No gym" }, { status: 400 });

  const r = await listPrograms({ tenantId, gymId, memberId: userId, prisma });
  if (!r.success) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json(r.data);
}
```

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add src/lib/server-actions/gym-crud.ts tests/lib/server-actions/gym-crud.test.ts src/app/api/me/fitness/programs/route.ts
git commit -m "feat(fitness): seed programs on gym create + member programs API"
```

---

## Task 7: "use server" action wrappers (auth-bound)

The CRUD module takes explicit args. The UI needs `"use server"` wrappers that resolve auth context and call them. These are the functions imported by manager pages and member client components.

**Files:**
- Create: `src/lib/server-actions/fitness-actions.ts`

- [ ] **Step 1: Implement wrappers**

```ts
// src/lib/server-actions/fitness-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { FitnessProgramType, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentAuthContext } from "@/lib/auth-context";
import * as crud from "@/lib/server-actions/fitness-program-crud";

function unauthorized() {
  return { success: false as const, error: "UNAUTHORIZED" };
}

// ---- Manager actions (gym programs) ----

export async function managerCreateProgram(input: {
  name: string;
  color: string;
  type: FitnessProgramType;
}) {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId || !ctx.gymId || ctx.role !== Role.MANAGER) return unauthorized();
  const r = await crud.createProgram({
    tenantId: ctx.tenantId,
    gymId: ctx.gymId,
    createdById: null,
    name: input.name,
    color: input.color,
    type: input.type,
    prisma,
  });
  revalidatePath("/manager/fitness");
  return r;
}

export async function managerUpdateProgram(input: {
  id: string;
  name?: string;
  color?: string;
  type?: FitnessProgramType;
  isActive?: boolean;
}) {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId || ctx.role !== Role.MANAGER) return unauthorized();
  const r = await crud.updateProgram({ ...input, tenantId: ctx.tenantId, actorId: ctx.userId, isManager: true, prisma });
  revalidatePath("/manager/fitness");
  return r;
}

export async function managerDeleteProgram(id: string) {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId || ctx.role !== Role.MANAGER) return unauthorized();
  const r = await crud.deleteProgram({ id, tenantId: ctx.tenantId, actorId: ctx.userId, isManager: true, prisma });
  revalidatePath("/manager/fitness");
  return r;
}

export async function managerAddExercise(input: {
  programId: string; name: string; sets: number; repsOrDurationSec: number;
  recoverySec: number; muscles: string; steps: string[]; tip?: string | null;
}) {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId || ctx.role !== Role.MANAGER) return unauthorized();
  const r = await crud.addExercise({ ...input, tenantId: ctx.tenantId, actorId: ctx.userId, isManager: true, prisma });
  revalidatePath(`/manager/fitness/${input.programId}`);
  return r;
}

export async function managerUpdateExercise(input: {
  id: string; name?: string; sets?: number; repsOrDurationSec?: number;
  recoverySec?: number; muscles?: string; steps?: string[]; tip?: string | null;
}) {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId || ctx.role !== Role.MANAGER) return unauthorized();
  const r = await crud.updateExercise({ ...input, tenantId: ctx.tenantId, actorId: ctx.userId, isManager: true, prisma });
  revalidatePath("/manager/fitness");
  return r;
}

export async function managerDeleteExercise(id: string) {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId || ctx.role !== Role.MANAGER) return unauthorized();
  const r = await crud.deleteExercise({ id, tenantId: ctx.tenantId, actorId: ctx.userId, isManager: true, prisma });
  revalidatePath("/manager/fitness");
  return r;
}

// ---- Member actions (private programs) ----

export async function memberCreateProgram(input: { name: string; color: string }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId || !ctx.gymId || ctx.role !== Role.MEMBER) return unauthorized();
  const r = await crud.createProgram({
    tenantId: ctx.tenantId, gymId: ctx.gymId, createdById: ctx.userId,
    name: input.name, color: input.color, type: FitnessProgramType.CUSTOM, prisma,
  });
  revalidatePath("/me/fitness");
  return r;
}

export async function memberUpdateProgram(input: { id: string; name?: string; color?: string }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId || ctx.role !== Role.MEMBER) return unauthorized();
  const r = await crud.updateProgram({ ...input, tenantId: ctx.tenantId, actorId: ctx.userId, isManager: false, prisma });
  revalidatePath("/me/fitness");
  return r;
}

export async function memberDeleteProgram(id: string) {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId || ctx.role !== Role.MEMBER) return unauthorized();
  const r = await crud.deleteProgram({ id, tenantId: ctx.tenantId, actorId: ctx.userId, isManager: false, prisma });
  revalidatePath("/me/fitness");
  return r;
}

export async function memberAddExercise(input: {
  programId: string; name: string; sets: number; repsOrDurationSec: number;
  recoverySec: number; muscles: string; steps: string[]; tip?: string | null;
}) {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId || ctx.role !== Role.MEMBER) return unauthorized();
  const r = await crud.addExercise({ ...input, tenantId: ctx.tenantId, actorId: ctx.userId, isManager: false, prisma });
  revalidatePath("/me/fitness");
  return r;
}

export async function memberDeleteExercise(id: string) {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId || ctx.role !== Role.MEMBER) return unauthorized();
  const r = await crud.deleteExercise({ id, tenantId: ctx.tenantId, actorId: ctx.userId, isManager: false, prisma });
  revalidatePath("/me/fitness");
  return r;
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add src/lib/server-actions/fitness-actions.ts
git commit -m "feat(fitness): auth-bound server action wrappers (manager + member)"
```

---

## Task 8: Manager UI — program list, create, edit

**Files:**
- Modify: `src/components/manager/nav.tsx`
- Create: `src/app/manager/fitness/page.tsx`
- Create: `src/app/manager/fitness/new/page.tsx`
- Create: `src/app/manager/fitness/[id]/page.tsx`
- Create: `src/components/manager/fitness-program-form.tsx`
- Create: `src/components/manager/fitness-exercise-editor.tsx`

- [ ] **Step 1: Add nav link**

In `src/components/manager/nav.tsx`, add inside the left link group (after Rapports):

```tsx
        <Link href="/manager/fitness" className="text-sm text-slate-400 hover:text-slate-200">Fitness</Link>
```

- [ ] **Step 2: Program list page**

```tsx
// src/app/manager/fitness/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { listPrograms } from "@/lib/server-actions/fitness-program-crud";

export const dynamic = "force-dynamic";

export default async function ManagerFitness() {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId || !ctx.gymId || ctx.role !== "MANAGER") redirect("/login");
  const r = await listPrograms({ tenantId: ctx.tenantId, gymId: ctx.gymId, prisma });
  const programs = r.success ? r.data : [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <h1 className="text-2xl font-semibold">Programmes fitness ({programs.length})</h1>
        <Link href="/manager/fitness/new" className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-sm font-medium">+ Nouveau</Link>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {programs.map((p) => (
          <Link key={p.id} href={`/manager/fitness/${p.id}`}
            className="block bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-lg p-4 transition-colors">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full" style={{ background: p.color }} />
              <span className="font-medium">{p.name}</span>
            </div>
            <p className="text-sm text-slate-400 mt-1">{p.exercises.length} exercices</p>
          </Link>
        ))}
        {programs.length === 0 && <p className="text-slate-500 text-sm">Aucun programme. Crée le premier.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Program form (client component)**

```tsx
// src/components/manager/fitness-program-form.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { managerCreateProgram } from "@/lib/server-actions/fitness-actions";
import type { FitnessProgramType } from "@prisma/client";

const TYPES: { value: FitnessProgramType; label: string }[] = [
  { value: "FULL_BODY", label: "Full Body" },
  { value: "GAINAGE_ABDOS", label: "Gainage & Abdos" },
  { value: "JAMBES_FESSIERS", label: "Jambes & Fessiers" },
  { value: "HAUT_CORPS", label: "Haut du Corps" },
  { value: "CUSTOM", label: "Personnalisé" },
];

export function FitnessProgramForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#C8FF00");
  const [type, setType] = useState<FitnessProgramType>("CUSTOM");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    const r = await managerCreateProgram({ name, color, type });
    setSaving(false);
    if (r.success) router.push(`/manager/fitness/${r.data.id}`);
    else setError(r.error);
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-md">
      <div>
        <label className="block text-sm text-slate-400 mb-1">Nom</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required
          className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100 text-sm" />
      </div>
      <div>
        <label className="block text-sm text-slate-400 mb-1">Type</label>
        <select value={type} onChange={(e) => setType(e.target.value as FitnessProgramType)}
          className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100 text-sm">
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm text-slate-400 mb-1">Couleur</label>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
          className="h-10 w-20 rounded bg-slate-900 border border-slate-700" />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button disabled={saving} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-sm font-medium disabled:opacity-50">
        {saving ? "..." : "Créer"}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: New program page**

```tsx
// src/app/manager/fitness/new/page.tsx
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { FitnessProgramForm } from "@/components/manager/fitness-program-form";

export const dynamic = "force-dynamic";

export default async function NewFitnessProgram() {
  const ctx = await getCurrentAuthContext();
  if (ctx?.role !== "MANAGER") redirect("/login");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nouveau programme</h1>
      <FitnessProgramForm />
    </div>
  );
}
```

- [ ] **Step 5: Exercise editor (client component)**

```tsx
// src/components/manager/fitness-exercise-editor.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { managerAddExercise, managerDeleteExercise } from "@/lib/server-actions/fitness-actions";
import type { ExerciseDTO } from "@/components/member/fitness/types";

export function FitnessExerciseEditor({ programId, exercises }: { programId: string; exercises: ExerciseDTO[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", sets: 3, repsOrDurationSec: 12, recoverySec: 60, muscles: "", steps: "", tip: "" });
  const [saving, setSaving] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await managerAddExercise({
      programId, name: form.name, sets: form.sets, repsOrDurationSec: form.repsOrDurationSec,
      recoverySec: form.recoverySec, muscles: form.muscles,
      steps: form.steps.split("\n").map((s) => s.trim()).filter(Boolean),
      tip: form.tip || null,
    });
    setSaving(false);
    setForm({ name: "", sets: 3, repsOrDurationSec: 12, recoverySec: 60, muscles: "", steps: "", tip: "" });
    router.refresh();
  }

  async function remove(id: string) {
    await managerDeleteExercise(id);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <ul className="space-y-2">
        {exercises.map((ex) => (
          <li key={ex.id} className="flex justify-between items-center bg-slate-900 border border-slate-800 rounded p-3">
            <div>
              <span className="font-medium">{ex.name}</span>
              <span className="text-sm text-slate-400 ml-2">
                {ex.sets} × {ex.repsOrDurationSec >= 100 ? `${ex.repsOrDurationSec}s` : `${ex.repsOrDurationSec} reps`} · {ex.muscles}
              </span>
            </div>
            <button onClick={() => remove(ex.id)} className="text-red-400 text-sm hover:text-red-300">Supprimer</button>
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="space-y-3 bg-slate-900 border border-slate-800 rounded p-4">
        <h3 className="font-medium">Ajouter un exercice</h3>
        <input placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
          className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-sm" />
        <div className="grid grid-cols-3 gap-2">
          <input type="number" placeholder="Séries" value={form.sets} onChange={(e) => setForm({ ...form, sets: +e.target.value })}
            className="px-3 py-2 rounded bg-slate-950 border border-slate-700 text-sm" />
          <input type="number" placeholder="Reps/sec (>=100 = sec)" value={form.repsOrDurationSec} onChange={(e) => setForm({ ...form, repsOrDurationSec: +e.target.value })}
            className="px-3 py-2 rounded bg-slate-950 border border-slate-700 text-sm" />
          <input type="number" placeholder="Récup (s)" value={form.recoverySec} onChange={(e) => setForm({ ...form, recoverySec: +e.target.value })}
            className="px-3 py-2 rounded bg-slate-950 border border-slate-700 text-sm" />
        </div>
        <input placeholder="Muscles ciblés" value={form.muscles} onChange={(e) => setForm({ ...form, muscles: e.target.value })}
          className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-sm" />
        <textarea placeholder="Étapes (une par ligne)" value={form.steps} onChange={(e) => setForm({ ...form, steps: e.target.value })} rows={5}
          className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-sm" />
        <input placeholder="Conseil clé" value={form.tip} onChange={(e) => setForm({ ...form, tip: e.target.value })}
          className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-sm" />
        <button disabled={saving} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-sm font-medium disabled:opacity-50">
          {saving ? "..." : "Ajouter"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 6: Edit program page**

```tsx
// src/app/manager/fitness/[id]/page.tsx
import { redirect, notFound } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { FitnessExerciseEditor } from "@/components/manager/fitness-exercise-editor";
import type { ExerciseDTO } from "@/components/member/fitness/types";

export const dynamic = "force-dynamic";

export default async function EditFitnessProgram({ params }: { params: { id: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId || ctx.role !== "MANAGER") redirect("/login");
  const program = await prisma.fitnessProgram.findFirst({
    where: { id: params.id, tenantId: ctx.tenantId, createdById: null },
    include: { exercises: { orderBy: { order: "asc" } } },
  });
  if (!program) notFound();

  const exercises: ExerciseDTO[] = program.exercises.map((e) => ({
    id: e.id, name: e.name, sets: e.sets, repsOrDurationSec: e.repsOrDurationSec,
    recoverySec: e.recoverySec, muscles: e.muscles, steps: e.steps as string[], tip: e.tip, order: e.order,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="w-4 h-4 rounded-full" style={{ background: program.color }} />
        <h1 className="text-2xl font-semibold">{program.name}</h1>
      </div>
      <FitnessExerciseEditor programId={program.id} exercises={exercises} />
    </div>
  );
}
```

- [ ] **Step 7: Manual verify**

Run dev server, log in as MANAGER, visit `/manager/fitness`. Expected: 4 seeded programs listed. Open one → see 6 exercises. Add an exercise → it appears. Delete it → it disappears. Create a new program → redirected to its edit page.

- [ ] **Step 8: Typecheck + commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add src/components/manager/nav.tsx src/app/manager/fitness src/components/manager/fitness-program-form.tsx src/components/manager/fitness-exercise-editor.tsx
git commit -m "feat(fitness): manager UI for program + exercise management"
```

---

## Task 9: useFitApp hook + circular timer + tracker shell

**Files:**
- Create: `src/hooks/use-fit-app.ts`
- Create: `src/components/member/fitness/circular-timer.tsx`
- Create: `src/app/me/fitness/page.tsx`
- Create: `src/components/member/fitness-tracker.tsx`

- [ ] **Step 1: localStorage hook**

```ts
// src/hooks/use-fit-app.ts
"use client";
import { useCallback, useEffect, useState } from "react";
import type { FitAppData, FitProfile, WeekDay, WeightEntry, SleepEntry, SessionEntry } from "@/components/member/fitness/types";
import { WEEKLY_SCHEDULE } from "@/lib/fitness-defaults";

const KEY = "fitapp_v3";

function emptyData(): FitAppData {
  return { profile: null, weekData: [], weights: [], sleeps: [], sessions: [] };
}

function buildWeekData(weeks: number): WeekDay[][] {
  return Array.from({ length: weeks }, () =>
    WEEKLY_SCHEDULE.map((d) => ({ type: d.type, label: d.label, durationMin: d.durationMin, done: false })),
  );
}

export function useFitApp() {
  const [data, setData] = useState<FitAppData>(emptyData);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setData(JSON.parse(raw) as FitAppData);
    } catch { /* ignore corrupt */ }
    setLoaded(true);
  }, []);

  const persist = useCallback((next: FitAppData) => {
    setData(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* quota */ }
  }, []);

  const setProfile = useCallback((profile: FitProfile) => {
    persist({ ...data, profile, weekData: buildWeekData(profile.durationWeeks) });
  }, [data, persist]);

  const toggleDay = useCallback((week: number, day: number) => {
    const weekData = data.weekData.map((w, wi) =>
      wi === week ? w.map((d, di) => (di === day ? { ...d, done: !d.done } : d)) : w,
    );
    persist({ ...data, weekData });
  }, [data, persist]);

  const addWeight = useCallback((entry: WeightEntry, sleep?: SleepEntry) => {
    persist({
      ...data,
      weights: [...data.weights, entry],
      sleeps: sleep ? [...data.sleeps, sleep] : data.sleeps,
    });
  }, [data, persist]);

  const addSession = useCallback((entry: SessionEntry) => {
    persist({ ...data, sessions: [entry, ...data.sessions] });
  }, [data, persist]);

  const reset = useCallback(() => persist(emptyData()), [persist]);

  return { data, loaded, setProfile, toggleDay, addWeight, addSession, reset };
}
```

- [ ] **Step 2: Reusable circular SVG timer**

```tsx
// src/components/member/fitness/circular-timer.tsx
"use client";

export function CircularTimer({
  progress, // 0..1
  color = "#C8FF00",
  size = 220,
  stroke = 12,
  children,
}: {
  progress: number;
  color?: string;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(1, progress)));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#1e293b" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.5s linear" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
```

- [ ] **Step 3: Server wrapper page**

```tsx
// src/app/me/fitness/page.tsx
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { listPrograms } from "@/lib/server-actions/fitness-program-crud";
import { FitnessTracker } from "@/components/member/fitness-tracker";
import type { ProgramDTO } from "@/components/member/fitness/types";

export const dynamic = "force-dynamic";

export default async function MeFitness() {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.userId || ctx.role !== "MEMBER") redirect("/login");
  if (!ctx.tenantId || !ctx.gymId) redirect("/me");

  const r = await listPrograms({ tenantId: ctx.tenantId, gymId: ctx.gymId, memberId: ctx.userId, prisma });
  const raw = r.success ? r.data : [];
  const programs: ProgramDTO[] = raw.map((p) => ({
    id: p.id, name: p.name, color: p.color, type: p.type, createdById: p.createdById,
    exercises: p.exercises.map((e) => ({
      id: e.id, name: e.name, sets: e.sets, repsOrDurationSec: e.repsOrDurationSec,
      recoverySec: e.recoverySec, muscles: e.muscles, steps: e.steps as string[], tip: e.tip, order: e.order,
    })),
  }));

  return <FitnessTracker programs={programs} memberId={ctx.userId} />;
}
```

- [ ] **Step 4: Tracker shell (tabs + bottom nav + onboarding)**

```tsx
// src/components/member/fitness-tracker.tsx
"use client";
import { useState } from "react";
import { useFitApp } from "@/hooks/use-fit-app";
import type { ProgramDTO, FitProfile } from "@/components/member/fitness/types";
import { TabHome } from "@/components/member/fitness/tab-home";
import { TabWalk } from "@/components/member/fitness/tab-walk";
import { TabProgram } from "@/components/member/fitness/tab-program";
import { TabMuscu } from "@/components/member/fitness/tab-muscu";
import { TabWeight } from "@/components/member/fitness/tab-weight";

type Tab = "home" | "walk" | "program" | "muscu" | "weight";

const NAV: { id: Tab; icon: string; label: string }[] = [
  { id: "home", icon: "🏠", label: "Accueil" },
  { id: "walk", icon: "🚶", label: "Marche" },
  { id: "program", icon: "📅", label: "Programme" },
  { id: "muscu", icon: "💪", label: "Muscu" },
  { id: "weight", icon: "⚖️", label: "Suivi" },
];

export function FitnessTracker({ programs, memberId }: { programs: ProgramDTO[]; memberId: string }) {
  const fit = useFitApp();
  const [tab, setTab] = useState<Tab>("home");

  if (!fit.loaded) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Chargement…</div>;
  }

  if (!fit.data.profile) {
    return <Onboarding onDone={fit.setProfile} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      <div className="max-w-md mx-auto">
        {tab === "home" && <TabHome fit={fit} onNav={setTab} />}
        {tab === "walk" && <TabWalk fit={fit} />}
        {tab === "program" && <TabProgram fit={fit} />}
        {tab === "muscu" && <TabMuscu programs={programs} memberId={memberId} fit={fit} />}
        {tab === "weight" && <TabWeight fit={fit} />}
      </div>

      <nav className="fixed bottom-0 inset-x-0 bg-slate-900 border-t border-slate-800">
        <div className="max-w-md mx-auto grid grid-cols-5">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => setTab(n.id)}
              className="relative flex flex-col items-center py-2 text-xs">
              {tab === n.id && <span className="absolute top-0 inset-x-4 h-0.5" style={{ background: "#C8FF00" }} />}
              <span className="text-lg">{n.icon}</span>
              <span className={tab === n.id ? "text-slate-100" : "text-slate-500"}>{n.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

function Onboarding({ onDone }: { onDone: (p: FitProfile) => void }) {
  const [start, setStart] = useState(92);
  const [goal, setGoal] = useState(85);
  const [weeks, setWeeks] = useState<4 | 8 | 12>(8);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-5">
        <h1 className="text-xl font-semibold text-center">Configure ton programme</h1>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Poids actuel (kg)</label>
          <input type="number" step="0.1" value={start} onChange={(e) => setStart(+e.target.value)}
            className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-sm" />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Poids objectif (kg)</label>
          <input type="number" step="0.1" value={goal} onChange={(e) => setGoal(+e.target.value)}
            className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-sm" />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Durée</label>
          <div className="grid grid-cols-3 gap-2">
            {[4, 8, 12].map((w) => (
              <button key={w} onClick={() => setWeeks(w as 4 | 8 | 12)}
                className={`py-2 rounded text-sm border ${weeks === w ? "border-lime-400 text-lime-300" : "border-slate-700 text-slate-400"}`}>
                {w} sem
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => onDone({ startWeightKg: start, goalWeightKg: goal, durationWeeks: weeks, startDate: new Date().toISOString() })}
          className="w-full py-3 rounded font-semibold text-slate-900" style={{ background: "#C8FF00" }}>
          Démarrer
        </button>
      </div>
    </div>
  );
}
```

> NOTE: Tabs `tab-home/walk/program/muscu/weight` don't exist yet, so this file won't typecheck until Tasks 10-14 are done. Create stub files now so it compiles incrementally — each tab default-exports a component accepting the props used above. Replace stubs in later tasks.

- [ ] **Step 5: Create stubs for the 5 tabs**

For each path below, create a minimal stub:

```tsx
// src/components/member/fitness/tab-home.tsx
"use client";
import type { useFitApp } from "@/hooks/use-fit-app";
export function TabHome({ fit, onNav }: { fit: ReturnType<typeof useFitApp>; onNav: (t: any) => void }) {
  return <div className="p-4">Home</div>;
}
```

Repeat with matching prop shapes:
- `tab-walk.tsx` → `export function TabWalk({ fit }: { fit: ReturnType<typeof useFitApp> })`
- `tab-program.tsx` → `export function TabProgram({ fit }: { fit: ReturnType<typeof useFitApp> })`
- `tab-muscu.tsx` → `export function TabMuscu({ programs, memberId, fit }: { programs: any[]; memberId: string; fit: ReturnType<typeof useFitApp> })`
- `tab-weight.tsx` → `export function TabWeight({ fit }: { fit: ReturnType<typeof useFitApp> })`

- [ ] **Step 6: Typecheck + commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add src/hooks/use-fit-app.ts src/components/member/fitness src/app/me/fitness/page.tsx src/components/member/fitness-tracker.tsx
git commit -m "feat(fitness): member tracker shell, hook, timer, onboarding"
```

---

## Task 10: Tab Home

**Files:**
- Modify (replace stub): `src/components/member/fitness/tab-home.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/components/member/fitness/tab-home.tsx
"use client";
import type { useFitApp } from "@/hooks/use-fit-app";
import { currentWeek, weekTargetWeight } from "@/lib/fitness-utils";
import { DAY_ICONS } from "@/lib/fitness-defaults";

const DAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

export function TabHome({
  fit,
  onNav,
}: {
  fit: ReturnType<typeof useFitApp>;
  onNav: (t: "home" | "walk" | "program" | "muscu" | "weight") => void;
}) {
  const { profile, weekData, weights } = fit.data;
  if (!profile) return null;

  const total = profile.durationWeeks;
  const week = currentWeek(new Date(profile.startDate), new Date(), total);
  const latest = weights.length ? weights[weights.length - 1].weightKg : profile.startWeightKg;
  const target = weekTargetWeight(profile.startWeightKg, profile.goalWeightKg, week, total);

  const span = profile.startWeightKg - profile.goalWeightKg;
  const done = profile.startWeightKg - latest;
  const pct = span > 0 ? Math.max(0, Math.min(100, (done / span) * 100)) : 0;

  const todayIdx = (new Date().getDay() + 6) % 7; // Mon=0
  const today = weekData[week - 1]?.[todayIdx];

  return (
    <div className="p-4 space-y-5">
      <header className="flex justify-between items-center">
        <div>
          <p className="text-sm text-slate-400">Semaine {week}/{total}</p>
          <p className="text-2xl font-bold">{latest.toFixed(1)} kg</p>
        </div>
        <span className="text-3xl">{today ? DAY_ICONS[today.type] : "💪"}</span>
      </header>

      <section className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-slate-400">{profile.startWeightKg} kg</span>
          <span style={{ color: "#C8FF00" }}>Cible S{week}: {target.toFixed(1)} kg</span>
          <span className="text-slate-400">{profile.goalWeightKg} kg</span>
        </div>
        <div className="h-3 rounded-full bg-slate-800 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "#C8FF00", transition: "width 0.5s" }} />
        </div>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <p className="text-sm text-slate-400 mb-1">Aujourd&apos;hui</p>
        {today ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{DAY_ICONS[today.type]} {today.label}</p>
              {today.durationMin && <p className="text-sm text-slate-400">{today.durationMin} min</p>}
            </div>
            <button onClick={() => onNav(today.type === "marche" ? "walk" : today.type === "muscu" ? "muscu" : "program")}
              className="px-3 py-1.5 rounded text-sm font-medium text-slate-900" style={{ background: "#C8FF00" }}>
              Commencer
            </button>
          </div>
        ) : <p className="text-slate-500 text-sm">Repos</p>}
      </section>

      <section>
        <div className="grid grid-cols-7 gap-1">
          {DAY_LABELS.map((d, i) => {
            const day = weekData[week - 1]?.[i];
            return (
              <div key={i} className={`flex flex-col items-center py-2 rounded ${i === todayIdx ? "bg-slate-800" : ""}`}>
                <span className="text-xs text-slate-400">{d}</span>
                <span className="text-lg">{day ? DAY_ICONS[day.type] : "·"}</span>
                <span className="text-xs">{day?.done ? "✅" : "⚪"}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <button onClick={() => onNav("walk")} className="py-3 rounded bg-slate-900 border border-slate-800 hover:border-slate-600 text-sm transition-colors">🚶 Marche Japonaise</button>
        <button onClick={() => onNav("muscu")} className="py-3 rounded bg-slate-900 border border-slate-800 hover:border-slate-600 text-sm transition-colors">💪 Circuit Abdos</button>
        <button onClick={() => onNav("weight")} className="py-3 rounded bg-slate-900 border border-slate-800 hover:border-slate-600 text-sm transition-colors">⚖️ Peser & Suivre</button>
        <button onClick={() => onNav("program")} className="py-3 rounded bg-slate-900 border border-slate-800 hover:border-slate-600 text-sm transition-colors">📅 Programme</button>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add src/components/member/fitness/tab-home.tsx
git commit -m "feat(fitness): home tab — week header, progress bar, day grid"
```

---

## Task 11: Tab Walk (Marche Japonaise timer)

**Files:**
- Modify (replace stub): `src/components/member/fitness/tab-walk.tsx`

Cycle model: phase WALK = 2 min @ 6 km/h, phase FAST = 3 min @ 8 km/h, repeated until 30 min total elapsed. Tick every second with `setInterval`.

- [ ] **Step 1: Implement**

```tsx
// src/components/member/fitness/tab-walk.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import type { useFitApp } from "@/hooks/use-fit-app";
import { CircularTimer } from "@/components/member/fitness/circular-timer";
import { walkCalories } from "@/lib/fitness-utils";

const WALK_SEC = 120;   // 2 min @ 6 km/h
const FAST_SEC = 180;   // 3 min @ 8 km/h
const CYCLE_SEC = WALK_SEC + FAST_SEC;
const TOTAL_SEC = 30 * 60;

function phaseAt(elapsed: number): { phase: "MARCHE" | "RAPIDE"; speed: number; remaining: number } {
  const inCycle = elapsed % CYCLE_SEC;
  if (inCycle < WALK_SEC) return { phase: "MARCHE", speed: 6, remaining: WALK_SEC - inCycle };
  return { phase: "RAPIDE", speed: 8, remaining: CYCLE_SEC - inCycle };
}

export function TabWalk({ fit }: { fit: ReturnType<typeof useFitApp> }) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      ref.current = setInterval(() => setElapsed((e) => Math.min(e + 1, TOTAL_SEC)), 1000);
    }
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [running]);

  useEffect(() => { if (elapsed >= TOTAL_SEC) setRunning(false); }, [elapsed]);

  const done = elapsed >= TOTAL_SEC;
  const { phase, speed, remaining } = phaseAt(elapsed);
  const cycles = Math.floor(elapsed / CYCLE_SEC);
  const kcal = walkCalories(elapsed / 60);
  const mm = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  function reset() { setRunning(false); setElapsed(0); }
  function save() {
    fit.addSession({ date: new Date().toISOString(), programId: "walk", programName: "Marche Japonaise", durationMin: Math.round(elapsed / 60) });
    reset();
  }

  if (done) {
    return (
      <div className="p-4 space-y-5 text-center">
        <h1 className="text-xl font-semibold">Séance terminée 🎉</h1>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Cycles" value={`${cycles}`} />
          <Stat label="Calories" value={`${kcal}`} />
          <Stat label="Durée" value={`${Math.round(elapsed / 60)} min`} />
        </div>
        <button onClick={save} className="w-full py-3 rounded font-semibold text-slate-900" style={{ background: "#C8FF00" }}>Enregistrer</button>
        <button onClick={reset} className="w-full py-2 rounded bg-slate-800 text-sm">Recommencer</button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 flex flex-col items-center">
      <h1 className="text-lg font-semibold self-start">Marche Japonaise</h1>
      <CircularTimer progress={remaining / (phase === "MARCHE" ? WALK_SEC : FAST_SEC)} color={phase === "RAPIDE" ? "#FF6B35" : "#C8FF00"}>
        <span className="text-sm text-slate-400">{phase}</span>
        <span className="text-4xl font-bold">{mm(remaining)}</span>
        <span className="text-sm text-slate-400">{speed} km/h</span>
      </CircularTimer>
      <div className="grid grid-cols-3 gap-2 w-full">
        <Stat label="Total" value={mm(elapsed)} />
        <Stat label="Cycles" value={`${cycles}`} />
        <Stat label="Kcal" value={`${kcal}`} />
      </div>
      <div className="flex gap-2 w-full">
        <button onClick={() => setRunning((r) => !r)} className="flex-1 py-3 rounded font-semibold text-slate-900" style={{ background: "#C8FF00" }}>
          {running ? "Pause" : "Démarrer"}
        </button>
        <button onClick={reset} className="px-4 py-3 rounded bg-slate-800 text-sm">↺</button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded p-3 text-center">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add src/components/member/fitness/tab-walk.tsx
git commit -m "feat(fitness): walk timer tab with cycle phases + SVG ring"
```

---

## Task 12: Tab Program (8-week selector)

**Files:**
- Modify (replace stub): `src/components/member/fitness/tab-program.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/components/member/fitness/tab-program.tsx
"use client";
import { useState } from "react";
import type { useFitApp } from "@/hooks/use-fit-app";
import { weekTargetWeight, currentWeek } from "@/lib/fitness-utils";
import { weekCalories, DAY_ICONS } from "@/lib/fitness-defaults";

export function TabProgram({ fit }: { fit: ReturnType<typeof useFitApp> }) {
  const { profile, weekData } = fit.data;
  const total = profile?.durationWeeks ?? 8;
  const live = profile ? currentWeek(new Date(profile.startDate), new Date(), total) : 1;
  const [selected, setSelected] = useState(live);

  if (!profile) return null;
  const target = weekTargetWeight(profile.startWeightKg, profile.goalWeightKg, selected, total);
  const days = weekData[selected - 1] ?? [];

  return (
    <div className="p-4 space-y-5">
      <h1 className="text-lg font-semibold">Programme {total} semaines</h1>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {Array.from({ length: total }, (_, i) => i + 1).map((w) => (
          <button key={w} onClick={() => setSelected(w)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm border ${selected === w ? "border-lime-400 text-lime-300" : "border-slate-700 text-slate-400"}`}>
            S{w}
          </button>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex justify-between">
        <div>
          <p className="text-xs text-slate-400">Objectif poids</p>
          <p className="text-xl font-bold">{target.toFixed(1)} kg</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Calories / jour</p>
          <p className="text-xl font-bold">{weekCalories(selected)}</p>
        </div>
      </div>

      <ul className="space-y-2">
        {days.map((d, i) => (
          <li key={i}
            className="flex items-center justify-between bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-lg p-3 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{DAY_ICONS[d.type]}</span>
              <div>
                <p className="font-medium">{["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"][i]} · {d.label}</p>
                {d.durationMin && <p className="text-sm text-slate-400">{d.durationMin} min</p>}
              </div>
            </div>
            <button onClick={() => fit.toggleDay(selected - 1, i)} className="text-2xl">
              {d.done ? "✅" : "⚪"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add src/components/member/fitness/tab-program.tsx
git commit -m "feat(fitness): program tab — week selector, targets, day checkboxes"
```

---

## Task 13: Tab Muscu + session overlay

**Files:**
- Create: `src/components/member/fitness/session-overlay.tsx`
- Modify (replace stub): `src/components/member/fitness/tab-muscu.tsx`

- [ ] **Step 1: Session overlay (active workout)**

State machine per exercise: `READY → WORK → RECOVERY → (next set or next exercise) → DONE`. Timed exercises (`repsOrDurationSec >= 100`) auto-count down; rep exercises wait for "Série faite".

```tsx
// src/components/member/fitness/session-overlay.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { CircularTimer } from "@/components/member/fitness/circular-timer";
import type { ProgramDTO } from "@/components/member/fitness/types";

type Phase = "ready" | "work" | "recovery" | "done";

export function SessionOverlay({
  program,
  onClose,
  onFinish,
}: {
  program: ProgramDTO;
  onClose: () => void;
  onFinish: (durationMin: number) => void;
}) {
  const exercises = program.exercises;
  const [exIdx, setExIdx] = useState(0);
  const [set, setSet] = useState(1);
  const [phase, setPhase] = useState<Phase>("ready");
  const [secLeft, setSecLeft] = useState(0);
  const startedAt = useRef(Date.now());
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const ex = exercises[exIdx];
  const isTimed = ex ? ex.repsOrDurationSec >= 100 : false;
  const workSec = ex ? ex.repsOrDurationSec : 0;

  useEffect(() => {
    if ((phase === "work" && isTimed) || phase === "recovery") {
      timer.current = setInterval(() => setSecLeft((s) => Math.max(0, s - 1)), 1000);
    }
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [phase, isTimed]);

  useEffect(() => {
    if (secLeft === 0) {
      if (phase === "work" && isTimed) finishSet();
      else if (phase === "recovery") nextAfterRecovery();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secLeft]);

  if (!ex) return null;

  function startWork() {
    setPhase("work");
    if (isTimed) setSecLeft(workSec);
  }
  function finishSet() {
    if (set < ex.sets) {
      setPhase("recovery");
      setSecLeft(ex.recoverySec);
    } else {
      goNextExercise();
    }
  }
  function nextAfterRecovery() {
    setSet((s) => s + 1);
    setPhase("ready");
  }
  function skipRecovery() {
    if (timer.current) clearInterval(timer.current);
    nextAfterRecovery();
  }
  function goNextExercise() {
    if (exIdx < exercises.length - 1) {
      setExIdx((i) => i + 1);
      setSet(1);
      setPhase("ready");
    } else {
      setPhase("done");
    }
  }

  if (phase === "done") {
    const min = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000));
    return (
      <Overlay>
        <div className="text-center space-y-5">
          <h2 className="text-2xl font-bold">Séance terminée 🎉</h2>
          <p className="text-slate-400">{exercises.length} exercices · {min} min</p>
          <button onClick={() => { onFinish(min); onClose(); }}
            className="w-full py-3 rounded font-semibold text-slate-900" style={{ background: program.color }}>
            Retour
          </button>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay>
      <div className="w-full space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={onClose} className="text-slate-400 text-sm">✕ Quitter</button>
          <span className="text-sm text-slate-400">{exIdx + 1}/{exercises.length}</span>
        </div>

        <div className="flex gap-1 justify-center">
          {exercises.map((_, i) => (
            <span key={i} className={`h-1.5 w-6 rounded-full ${i <= exIdx ? "" : "bg-slate-700"}`} style={i <= exIdx ? { background: program.color } : undefined} />
          ))}
        </div>

        <div className="text-center">
          <h2 className="text-xl font-bold">{ex.name}</h2>
          <p className="text-sm text-slate-400">{ex.muscles}</p>
          <p className="text-sm mt-1" style={{ color: program.color }}>Série {set}/{ex.sets}</p>
        </div>

        {phase === "recovery" ? (
          <div className="flex flex-col items-center gap-3">
            <CircularTimer progress={secLeft / ex.recoverySec} color="#FF6B35">
              <span className="text-sm text-slate-400">Récup</span>
              <span className="text-4xl font-bold">{secLeft}s</span>
            </CircularTimer>
            <button onClick={skipRecovery} className="text-sm text-slate-400 underline">Passer la récupération</button>
          </div>
        ) : phase === "work" && isTimed ? (
          <div className="flex justify-center">
            <CircularTimer progress={secLeft / workSec} color={program.color}>
              <span className="text-4xl font-bold">{secLeft}s</span>
            </CircularTimer>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-6xl font-bold" style={{ color: program.color }}>{ex.repsOrDurationSec}</p>
            <p className="text-slate-400">répétitions</p>
          </div>
        )}

        <div className="flex gap-1 justify-center">
          {Array.from({ length: ex.sets }, (_, i) => (
            <span key={i} className={`h-3 w-3 rounded-full ${i < set - (phase === "ready" ? 1 : 0) ? "" : "bg-slate-700"}`}
              style={i < set - (phase === "ready" ? 1 : 0) ? { background: program.color } : undefined} />
          ))}
        </div>

        {phase === "ready" && (
          <button onClick={startWork} className="w-full py-3 rounded font-semibold text-slate-900" style={{ background: program.color }}>
            {set === 1 ? "Démarrer" : "C'est parti"}
          </button>
        )}
        {phase === "work" && !isTimed && (
          <button onClick={finishSet} className="w-full py-3 rounded font-semibold text-slate-900" style={{ background: program.color }}>
            Série faite → Récup
          </button>
        )}
        {phase === "work" && (
          <button onClick={goNextExercise} className="w-full py-2 rounded bg-slate-800 text-sm">Passer l&apos;exercice</button>
        )}
      </div>
    </Overlay>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Muscu tab**

```tsx
// src/components/member/fitness/tab-muscu.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { useFitApp } from "@/hooks/use-fit-app";
import type { ProgramDTO } from "@/components/member/fitness/types";
import { SessionOverlay } from "@/components/member/fitness/session-overlay";
import { memberCreateProgram } from "@/lib/server-actions/fitness-actions";

export function TabMuscu({
  programs,
  memberId,
  fit,
}: {
  programs: ProgramDTO[];
  memberId: string;
  fit: ReturnType<typeof useFitApp>;
}) {
  const router = useRouter();
  const [active, setActive] = useState<ProgramDTO | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const gymPrograms = programs.filter((p) => p.createdById === null);
  const myPrograms = programs.filter((p) => p.createdById === memberId);

  async function create() {
    if (!name.trim()) return;
    const r = await memberCreateProgram({ name, color: "#C8FF00" });
    setCreating(false); setName("");
    if (r.success) router.refresh();
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-lg font-semibold">Renforcement musculaire</h1>

      <section className="space-y-2">
        <h2 className="text-sm text-slate-400">Programmes de ta salle</h2>
        {gymPrograms.map((p) => <ProgramCard key={p.id} program={p} onStart={() => setActive(p)} />)}
        {gymPrograms.length === 0 && <p className="text-slate-500 text-sm">Aucun programme de salle.</p>}
      </section>

      <section className="space-y-2">
        <div className="flex justify-between items-center">
          <h2 className="text-sm text-slate-400">Mes programmes</h2>
          <button onClick={() => setCreating((v) => !v)} className="text-sm" style={{ color: "#C8FF00" }}>+ Créer</button>
        </div>
        {creating && (
          <div className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du programme"
              className="flex-1 px-3 py-2 rounded bg-slate-900 border border-slate-700 text-sm" />
            <button onClick={create} className="px-3 py-2 rounded text-sm font-medium text-slate-900" style={{ background: "#C8FF00" }}>OK</button>
          </div>
        )}
        {myPrograms.map((p) => <ProgramCard key={p.id} program={p} onStart={() => setActive(p)} />)}
        {myPrograms.length === 0 && !creating && <p className="text-slate-500 text-sm">Crée ton premier programme.</p>}
      </section>

      {active && active.exercises.length > 0 && (
        <SessionOverlay
          program={active}
          onClose={() => setActive(null)}
          onFinish={(min) => fit.addSession({ date: new Date().toISOString(), programId: active.id, programName: active.name, durationMin: min })}
        />
      )}
    </div>
  );
}

function ProgramCard({ program, onStart }: { program: ProgramDTO; onStart: () => void }) {
  return (
    <div className="bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-lg p-4 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full" style={{ background: program.color }} />
          <div>
            <p className="font-medium">{program.name}</p>
            <p className="text-sm text-slate-400">{program.exercises.length} exercices</p>
          </div>
        </div>
        <button onClick={onStart} disabled={program.exercises.length === 0}
          className="px-3 py-1.5 rounded text-sm font-medium text-slate-900 disabled:opacity-40" style={{ background: program.color }}>
          Démarrer
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add src/components/member/fitness/session-overlay.tsx src/components/member/fitness/tab-muscu.tsx
git commit -m "feat(fitness): muscu tab + active session overlay with timers"
```

---

## Task 14: Tab Weight (suivi poids)

**Files:**
- Modify (replace stub): `src/components/member/fitness/tab-weight.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/components/member/fitness/tab-weight.tsx
"use client";
import { useState } from "react";
import type { useFitApp } from "@/hooks/use-fit-app";

export function TabWeight({ fit }: { fit: ReturnType<typeof useFitApp> }) {
  const { profile, weights, sessions } = fit.data;
  const [weight, setWeight] = useState("");
  const [sleep, setSleep] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  if (!profile) return null;
  const latest = weights.length ? weights[weights.length - 1].weightKg : profile.startWeightKg;
  const lost = profile.startWeightKg - latest;
  const remaining = latest - profile.goalWeightKg;

  const last14 = weights.slice(-14);
  const max = Math.max(profile.startWeightKg, ...last14.map((w) => w.weightKg));
  const min = Math.min(profile.goalWeightKg, ...last14.map((w) => w.weightKg));
  const range = max - min || 1;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const w = parseFloat(weight);
    if (Number.isNaN(w)) return;
    const iso = new Date(date).toISOString();
    const s = sleep ? parseFloat(sleep) : NaN;
    fit.addWeight({ date: iso, weightKg: w }, Number.isNaN(s) ? undefined : { date: iso, hours: s });
    setWeight(""); setSleep("");
  }

  return (
    <div className="p-4 space-y-6">
      <div className="text-center">
        <p className="text-5xl font-bold">{latest.toFixed(1)}<span className="text-lg text-slate-400"> kg</span></p>
        <div className="flex justify-center gap-6 mt-2 text-sm">
          <span className="text-green-400">−{Math.max(0, lost).toFixed(1)} kg perdus</span>
          <span className="text-orange-400">{Math.max(0, remaining).toFixed(1)} kg restants</span>
        </div>
      </div>

      <section className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <p className="text-sm text-slate-400 mb-3">14 dernières pesées</p>
        <div className="flex items-end justify-between gap-1 h-32">
          {last14.length === 0 && <p className="text-slate-500 text-sm">Aucune pesée.</p>}
          {last14.map((w, i) => {
            const h = 10 + ((max - w.weightKg) / range) * 0 + ((w.weightKg - min) / range) * 90;
            return <div key={i} className="flex-1 rounded-t" style={{ height: `${Math.max(8, h)}%`, background: "#C8FF00" }} title={`${w.weightKg} kg`} />;
          })}
        </div>
      </section>

      <form onSubmit={submit} className="space-y-3 bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Poids (kg)</label>
            <input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} required
              className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Sommeil (h)</label>
            <input type="number" step="0.5" value={sleep} onChange={(e) => setSleep(e.target.value)}
              className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-sm" />
        </div>
        <button className="w-full py-2 rounded font-semibold text-slate-900" style={{ background: "#C8FF00" }}>Enregistrer</button>
      </form>

      <section>
        <p className="text-sm text-slate-400 mb-2">5 dernières séances</p>
        <ul className="space-y-1">
          {sessions.slice(0, 5).map((s, i) => (
            <li key={i} className="flex justify-between text-sm bg-slate-900 border border-slate-800 rounded px-3 py-2">
              <span>{s.programName}</span>
              <span className="text-slate-400">{new Date(s.date).toLocaleDateString("fr-FR")} · {s.durationMin} min</span>
            </li>
          ))}
          {sessions.length === 0 && <li className="text-slate-500 text-sm">Aucune séance enregistrée.</li>}
        </ul>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add src/components/member/fitness/tab-weight.tsx
git commit -m "feat(fitness): weight tracking tab — stats, bar chart, log form"
```

---

## Task 15: Member entry link + full verification

**Files:**
- Modify: `src/app/me/page.tsx`

- [ ] **Step 1: Add a Fitness link card on `/me`**

In `src/app/me/page.tsx`, add a new `<section>` inside the main content container (after the "Abonnement" section). Import `Link` is already present:

```tsx
        {/* Fitness */}
        <section>
          <Link href="/me/fitness"
            className="block bg-slate-900 border border-slate-800 hover:border-lime-500 rounded-lg p-4 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">💪 Mon suivi fitness</h2>
                <p className="text-sm text-slate-400">Programme, séances, poids et progression</p>
              </div>
              <span className="text-slate-500">→</span>
            </div>
          </Link>
        </section>
```

- [ ] **Step 2: Full typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Full test suite**

Run: `npm test`
Expected: all prior tests + new fitness tests PASS (was 154; now 154 + fitness-utils + fitness-seed + fitness-program-crud + the added gym-crud seed test).

- [ ] **Step 4: Manual smoke test (dev server)**

Run: `npm run dev`
Then as a MEMBER:
1. Visit `/me` → click "Mon suivi fitness".
2. First visit → onboarding modal. Enter 92 / 85 / 8 sem → Démarrer.
3. Home tab → week 1/8, progress bar, today card, 7-day grid.
4. Marche tab → Démarrer; timer counts down, phase flips MARCHE/RAPIDE; pause works.
5. Programme tab → switch weeks S1..S8; toggle a day checkbox → persists after reload.
6. Muscu tab → gym programs (4 seeded) listed; start one → session overlay runs sets/recovery; finish → returns.
7. Create a private program → appears under "Mes programmes".
8. Suivi tab → log a weight → big number + bar chart update; reload page → data persists.

- [ ] **Step 5: Build check**

Run: `npm run build`
Expected: build succeeds, `/me/fitness`, `/manager/fitness`, `/manager/fitness/new`, `/manager/fitness/[id]`, and `/api/me/fitness/programs` all compile.

- [ ] **Step 6: Commit**

```bash
git add src/app/me/page.tsx
git commit -m "feat(fitness): add fitness entry link on member space"
```

---

## Verification Checklist (end of plan)

- [ ] `npm test` green (all suites)
- [ ] `npm run typecheck` clean
- [ ] `npm run build` succeeds
- [ ] Manager can CRUD gym programs + exercises at `/manager/fitness`
- [ ] New gym auto-seeds 4 default programs
- [ ] Member onboarding → 5 tabs all functional
- [ ] Member private programs isolated from other members (covered by `fitness-program-crud.test.ts`)
- [ ] localStorage `fitapp_v3` persists across reloads
- [ ] Zero external chart/icon deps added (check `package.json` unchanged)

---

## Notes for the implementer

- The spec's hardcoded "92kg / 85kg / 8 weeks" are defaults in the onboarding form only; the member overrides them.
- Mobile (Android) screens are explicitly out of scope for this plan. The `/api/me/fitness/programs` route already supports mobile bearer auth so a future RN screen can reuse it.
- `repsOrDurationSec >= 100` = seconds, `< 100` = reps. Keep this convention in any new UI.
- Member progression data is intentionally NOT in the DB (privacy decision). Do not add server persistence for weights/sessions in this plan.
