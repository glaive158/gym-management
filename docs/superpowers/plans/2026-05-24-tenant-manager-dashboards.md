# TENANT_ADMIN + MANAGER Dashboards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full CRUD interface for TENANT_ADMIN (multiple gyms + managers) and MANAGER (members + subscription plans). MANAGER assigned to one gym, sees only that gym's data.

**Architecture:** Server components for data fetching via `tenantPrisma`, server actions for mutations. Photo upload uses local filesystem for MVP (`/public/uploads/`) — S3 deferred to phase 2. Form pattern reused from Plan 2 (client form → API → server action).

**Tech Stack:** Next.js 14 Server Actions, Prisma, Zod, sharp (image resize), file-type (upload validation).

**Prerequisite:** Plan 2 merged. Branch `feat/tenant-manager-dashboards`. PostgreSQL running with seeded PLATFORM_OWNER.

---

## Schema additions

This plan introduces **Plan** (subscription formula), **Subscription** (member abonnement instance), and extends **User** for MEMBER role usage. Payment + CheckIn entities are deferred to Plan 4/5.

```prisma
model Plan {
  id             String    @id @default(cuid())
  tenantId       String
  gymId          String
  name           String
  durationDays   Int
  price          Int
  currency       String    @default("XOF")
  isActive       Boolean   @default(true)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  tenant         Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  gym            Gym       @relation(fields: [gymId], references: [id], onDelete: Cascade)
  subscriptions  Subscription[]

  @@index([tenantId])
  @@index([gymId])
}

enum SubscriptionStatus {
  PENDING
  ACTIVE
  EXPIRED
  CANCELLED
}

model Subscription {
  id          String              @id @default(cuid())
  tenantId    String
  memberId    String
  planId      String
  startDate   DateTime
  endDate     DateTime
  status      SubscriptionStatus  @default(PENDING)
  autoRenew   Boolean             @default(false)
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt

  tenant      Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  member      User                @relation("MemberSubscriptions", fields: [memberId], references: [id], onDelete: Cascade)
  plan        Plan                @relation(fields: [planId], references: [id])

  @@index([tenantId])
  @@index([memberId])
  @@index([endDate, status])
}
```

Update Tenant + Gym + User to declare the new relations.

---

## File Structure

```
gym-management/
├── prisma/schema.prisma                          # add Plan, Subscription, relations
├── public/uploads/                               # local photo storage (gitignored)
├── src/
│   ├── lib/
│   │   ├── upload.ts                             # photo save/validate
│   │   └── server-actions/
│   │       ├── gym-crud.ts                       # createGym, updateGym, deleteGym, listGyms
│   │       ├── manager-crud.ts                   # createManager, listManagers, deactivateManager
│   │       ├── plan-crud.ts                      # createPlan, listPlans, updatePlan, deactivatePlan
│   │       ├── member-crud.ts                    # createMember, listMembers, getMember, updateMember
│   │       └── subscription-crud.ts              # assignSubscription, cancelSubscription
│   ├── app/
│   │   ├── admin/
│   │   │   ├── gyms/
│   │   │   │   ├── page.tsx                      # list all gyms
│   │   │   │   ├── new/page.tsx                  # add gym (reuse wizard)
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx                  # gym detail (plans, managers)
│   │   │   │       └── edit/page.tsx
│   │   │   ├── managers/
│   │   │   │   ├── page.tsx                      # list managers
│   │   │   │   └── new/page.tsx                  # invite manager
│   │   │   └── plans/
│   │   │       └── page.tsx                      # plans across all gyms
│   │   ├── manager/
│   │   │   ├── layout.tsx                        # nav shell for MANAGER
│   │   │   ├── page.tsx                          # dashboard home (basic stats)
│   │   │   ├── members/
│   │   │   │   ├── page.tsx                      # list members
│   │   │   │   ├── new/page.tsx                  # add member
│   │   │   │   └── [id]/page.tsx                 # member detail + assign subscription
│   │   │   └── plans/
│   │   │       ├── page.tsx                      # this gym's plans
│   │   │       └── new/page.tsx                  # add plan
│   │   └── api/
│   │       ├── admin/
│   │       │   ├── gyms/route.ts                 # POST create
│   │       │   ├── gyms/[id]/route.ts            # PATCH update / DELETE
│   │       │   ├── managers/route.ts             # POST create
│   │       │   └── managers/[id]/deactivate/route.ts
│   │       ├── manager/
│   │       │   ├── members/route.ts              # POST create
│   │       │   ├── members/[id]/route.ts         # PATCH update
│   │       │   ├── plans/route.ts                # POST create
│   │       │   ├── plans/[id]/route.ts           # PATCH / DELETE
│   │       │   └── subscriptions/route.ts        # POST assign
│   │       └── upload/route.ts                   # POST avatar
│   └── components/
│       ├── ui/
│       │   ├── form-field.tsx                    # reusable label+input wrapper
│       │   └── empty-state.tsx
│       ├── admin/
│       │   ├── nav.tsx                           # extend with Gyms/Managers links
│       │   └── gym-form.tsx                      # reusable for create/edit
│       └── manager/
│           ├── nav.tsx
│           ├── member-form.tsx
│           └── plan-form.tsx
└── tests/lib/server-actions/
    ├── gym-crud.test.ts
    ├── manager-crud.test.ts
    ├── plan-crud.test.ts
    ├── member-crud.test.ts
    └── subscription-crud.test.ts
```

---

## Task 1: Schema additions (Plan, Subscription)

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add enum + models, update relations**

In `prisma/schema.prisma`:

After the `enum BillingStatus { ... }` block, add:
```prisma
enum SubscriptionStatus {
  PENDING
  ACTIVE
  EXPIRED
  CANCELLED
}
```

In the `Tenant` model, add these relation fields right before `@@index([status])`:
```prisma
  plans                 Plan[]
  subscriptions         Subscription[]
```

In the `User` model, add this relation right after `validatedTenants Tenant[] @relation("TenantValidator")`:
```prisma
  subscriptions         Subscription[] @relation("MemberSubscriptions")
```

In the `Gym` model, add these relations right after `users User[]`:
```prisma
  plans       Plan[]
```

At the end of the schema (after `Gym` model), append:
```prisma
model Plan {
  id             String    @id @default(cuid())
  tenantId       String
  gymId          String
  name           String
  durationDays   Int
  price          Int
  currency       String    @default("XOF")
  isActive       Boolean   @default(true)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  tenant         Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  gym            Gym       @relation(fields: [gymId], references: [id], onDelete: Cascade)
  subscriptions  Subscription[]

  @@index([tenantId])
  @@index([gymId])
}

model Subscription {
  id          String              @id @default(cuid())
  tenantId    String
  memberId    String
  planId      String
  startDate   DateTime
  endDate     DateTime
  status      SubscriptionStatus  @default(PENDING)
  autoRenew   Boolean             @default(false)
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt

  tenant      Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  member      User                @relation("MemberSubscriptions", fields: [memberId], references: [id], onDelete: Cascade)
  plan        Plan                @relation(fields: [planId], references: [id])

  @@index([tenantId])
  @@index([memberId])
  @@index([endDate, status])
}
```

- [ ] **Step 2: Generate migration via diff + apply**

```bash
cd /Users/admin/gym-management
MIGDIR=prisma/migrations/$(date -u +%Y%m%d%H%M%S)_add_plan_subscription
mkdir -p "$MIGDIR"
npx dotenv -e .env.local -- npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script > "$MIGDIR/migration.sql"
cat "$MIGDIR/migration.sql"
```

Verify the SQL creates the `Plan` table, `Subscription` table, `SubscriptionStatus` enum, indexes, and FKs.

Then apply:
```bash
npx dotenv -e .env.local -- npx prisma migrate deploy
DATABASE_URL="postgresql://admin@localhost:5432/gym_management_test?schema=public" npx prisma migrate deploy
npx dotenv -e .env.local -- npx prisma generate
```

- [ ] **Step 3: Extend test helper resetDb**

Modify `tests/helpers/db.ts`. Update `resetDb()` to also clear subscriptions and plans:
```typescript
export async function resetDb(): Promise<void> {
  await testPrisma.subscription.deleteMany();
  await testPrisma.plan.deleteMany();
  await testPrisma.user.deleteMany();
  await testPrisma.gym.deleteMany();
  await testPrisma.tenant.deleteMany();
}
```

- [ ] **Step 4: Update prisma-tenant TENANT_SCOPED_MODELS**

Modify `src/lib/prisma-tenant.ts`. Update the constant to include the new models:
```typescript
const TENANT_SCOPED_MODELS = new Set(["Gym", "User", "Plan", "Subscription"]);
```

- [ ] **Step 5: Verify all existing tests still pass**

```bash
npm test
```
Expected: 47 tests still pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(db): add Plan + Subscription models with tenant isolation"
```

---

## Task 2: Gym CRUD server actions (TDD)

**Files:**
- Create: `src/lib/server-actions/gym-crud.ts`, `tests/lib/server-actions/gym-crud.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/lib/server-actions/gym-crud.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, resetDb } from "../../helpers/db";
import { createGym, updateGym, listGyms, deleteGym } from "@/lib/server-actions/gym-crud";
import { TenantStatus } from "@prisma/client";

async function seedTenant() {
  return testPrisma.tenant.create({
    data: {
      name: "FitClub", slug: "fitclub", ownerEmail: "a@x.com",
      ownerPhone: "1", city: "Dakar", status: TenantStatus.ACTIVE,
    },
  });
}

const validInput = {
  name: "FitClub Plateau", address: "rue X", city: "Dakar",
  phone: "+221770000000", latitude: 14.7, longitude: -17.4,
};

describe("createGym", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("creates a gym scoped to tenant", async () => {
    const t = await seedTenant();
    const r = await createGym({ tenantId: t.id, ...validInput, prisma: testPrisma });
    expect(r.success).toBe(true);
    const gyms = await testPrisma.gym.findMany();
    expect(gyms).toHaveLength(1);
    expect(gyms[0].tenantId).toBe(t.id);
  });

  it("rejects invalid coordinates", async () => {
    const t = await seedTenant();
    const r = await createGym({ tenantId: t.id, ...validInput, latitude: 999, prisma: testPrisma });
    expect(r.success).toBe(false);
  });

  it("rejects empty name", async () => {
    const t = await seedTenant();
    const r = await createGym({ tenantId: t.id, ...validInput, name: "", prisma: testPrisma });
    expect(r.success).toBe(false);
  });
});

describe("listGyms", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("returns all gyms of a tenant ordered by name", async () => {
    const t = await seedTenant();
    await createGym({ tenantId: t.id, ...validInput, name: "Zeta", prisma: testPrisma });
    await createGym({ tenantId: t.id, ...validInput, name: "Alpha", prisma: testPrisma });
    const gyms = await listGyms({ tenantId: t.id, prisma: testPrisma });
    expect(gyms.map(g => g.name)).toEqual(["Alpha", "Zeta"]);
  });
});

describe("updateGym", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("updates a gym's name and phone", async () => {
    const t = await seedTenant();
    const c = await createGym({ tenantId: t.id, ...validInput, prisma: testPrisma });
    const r = await updateGym({
      tenantId: t.id, gymId: c.gymId!,
      name: "New Name", phone: "+221779999999", prisma: testPrisma,
    });
    expect(r.success).toBe(true);
    const updated = await testPrisma.gym.findUniqueOrThrow({ where: { id: c.gymId! } });
    expect(updated.name).toBe("New Name");
    expect(updated.phone).toBe("+221779999999");
  });

  it("rejects update of a gym from another tenant", async () => {
    const t1 = await seedTenant();
    const t2 = await testPrisma.tenant.create({
      data: { name: "B", slug: "b", ownerEmail: "b@x.com", ownerPhone: "1", city: "x", status: TenantStatus.ACTIVE },
    });
    const c = await createGym({ tenantId: t2.id, ...validInput, prisma: testPrisma });
    const r = await updateGym({
      tenantId: t1.id, gymId: c.gymId!,
      name: "Hack", prisma: testPrisma,
    });
    expect(r.success).toBe(false);
  });
});

describe("deleteGym", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("deletes a gym of the tenant", async () => {
    const t = await seedTenant();
    const c = await createGym({ tenantId: t.id, ...validInput, prisma: testPrisma });
    const r = await deleteGym({ tenantId: t.id, gymId: c.gymId!, prisma: testPrisma });
    expect(r.success).toBe(true);
    const gyms = await testPrisma.gym.findMany();
    expect(gyms).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
npm test -- tests/lib/server-actions/gym-crud.test.ts
```
Expected: module not found.

- [ ] **Step 3: Implement**

Create `src/lib/server-actions/gym-crud.ts`:
```typescript
import { z } from "zod";
import { PrismaClient, Gym } from "@prisma/client";
import { tenantPrisma } from "@/lib/prisma-tenant";

const GymBaseSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  address: z.string().min(1, "Adresse requise"),
  city: z.string().min(1, "Ville requise"),
  phone: z.string().min(5, "Téléphone requis"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const GymUpdateSchema = GymBaseSchema.partial();

export interface CreateGymInput {
  tenantId: string;
  prisma: PrismaClient;
  name: string;
  address: string;
  city: string;
  phone: string;
  latitude: number;
  longitude: number;
}

export async function createGym(input: CreateGymInput): Promise<{ success: boolean; gymId?: string; error?: string }> {
  const parsed = GymBaseSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const client = tenantPrisma(input.prisma, input.tenantId);
  const gym = await client.gym.create({ data: parsed.data });
  return { success: true, gymId: gym.id };
}

export interface ListGymsInput {
  tenantId: string;
  prisma: PrismaClient;
}

export async function listGyms(input: ListGymsInput): Promise<Gym[]> {
  const client = tenantPrisma(input.prisma, input.tenantId);
  return client.gym.findMany({ orderBy: { name: "asc" } });
}

export interface UpdateGymInput {
  tenantId: string;
  gymId: string;
  prisma: PrismaClient;
  name?: string;
  address?: string;
  city?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
}

export async function updateGym(input: UpdateGymInput): Promise<{ success: boolean; error?: string }> {
  const parsed = GymUpdateSchema.safeParse({
    name: input.name, address: input.address, city: input.city,
    phone: input.phone, latitude: input.latitude, longitude: input.longitude,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const client = tenantPrisma(input.prisma, input.tenantId);
  try {
    await client.gym.update({ where: { id: input.gymId }, data: parsed.data });
    return { success: true };
  } catch {
    return { success: false, error: "Salle introuvable" };
  }
}

export interface DeleteGymInput {
  tenantId: string;
  gymId: string;
  prisma: PrismaClient;
}

export async function deleteGym(input: DeleteGymInput): Promise<{ success: boolean; error?: string }> {
  const client = tenantPrisma(input.prisma, input.tenantId);
  try {
    await client.gym.delete({ where: { id: input.gymId } });
    return { success: true };
  } catch {
    return { success: false, error: "Salle introuvable" };
  }
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
npm test -- tests/lib/server-actions/gym-crud.test.ts
```
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add gym CRUD server actions with tenant-scoped tests"
```

---

## Task 3: Manager CRUD server actions (TDD)

**Files:**
- Create: `src/lib/server-actions/manager-crud.ts`, `tests/lib/server-actions/manager-crud.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/lib/server-actions/manager-crud.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, resetDb } from "../../helpers/db";
import { createManager, listManagers, deactivateManager } from "@/lib/server-actions/manager-crud";
import { Role, TenantStatus, UserStatus } from "@prisma/client";

async function seedTenantAndGym() {
  const t = await testPrisma.tenant.create({
    data: { name: "F", slug: "f", ownerEmail: "a@x.com", ownerPhone: "1", city: "Dakar", status: TenantStatus.ACTIVE },
  });
  const g = await testPrisma.gym.create({
    data: { tenantId: t.id, name: "G1", address: "x", city: "Dakar", phone: "1", latitude: 14.7, longitude: -17.4 },
  });
  return { t, g };
}

describe("createManager", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("creates a PENDING manager with activation token", async () => {
    const { t, g } = await seedTenantAndGym();
    const r = await createManager({
      tenantId: t.id, gymId: g.id,
      name: "Manager 1", email: "m1@x.com", phone: "+221770000000",
      prisma: testPrisma,
    });
    expect(r.success).toBe(true);
    const user = await testPrisma.user.findUniqueOrThrow({ where: { email: "m1@x.com" } });
    expect(user.role).toBe(Role.MANAGER);
    expect(user.status).toBe(UserStatus.PENDING);
    expect(user.tenantId).toBe(t.id);
    expect(user.gymId).toBe(g.id);
    expect(user.passwordHash).toBeNull();
    expect(user.activationToken).not.toBeNull();
    expect(r.activationUrl).toMatch(/\/activate\?token=/);
  });

  it("rejects duplicate email", async () => {
    const { t, g } = await seedTenantAndGym();
    await createManager({ tenantId: t.id, gymId: g.id, name: "A", email: "x@x.com", phone: "1", prisma: testPrisma });
    const r = await createManager({ tenantId: t.id, gymId: g.id, name: "B", email: "x@x.com", phone: "1", prisma: testPrisma });
    expect(r.success).toBe(false);
  });

  it("rejects gym from another tenant", async () => {
    const { t, g } = await seedTenantAndGym();
    const t2 = await testPrisma.tenant.create({
      data: { name: "T2", slug: "t2", ownerEmail: "b@x.com", ownerPhone: "1", city: "x", status: TenantStatus.ACTIVE },
    });
    const r = await createManager({
      tenantId: t2.id, gymId: g.id,
      name: "M", email: "m@x.com", phone: "1", prisma: testPrisma,
    });
    expect(r.success).toBe(false);
  });
});

describe("listManagers", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("returns managers of a tenant only", async () => {
    const { t, g } = await seedTenantAndGym();
    await createManager({ tenantId: t.id, gymId: g.id, name: "A", email: "a@x.com", phone: "1", prisma: testPrisma });
    await createManager({ tenantId: t.id, gymId: g.id, name: "B", email: "b@x.com", phone: "1", prisma: testPrisma });
    const list = await listManagers({ tenantId: t.id, prisma: testPrisma });
    expect(list).toHaveLength(2);
    expect(list.every(m => m.role === Role.MANAGER)).toBe(true);
  });
});

describe("deactivateManager", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("flips manager status to SUSPENDED", async () => {
    const { t, g } = await seedTenantAndGym();
    const c = await createManager({ tenantId: t.id, gymId: g.id, name: "A", email: "a@x.com", phone: "1", prisma: testPrisma });
    const r = await deactivateManager({ tenantId: t.id, managerId: c.userId!, prisma: testPrisma });
    expect(r.success).toBe(true);
    const u = await testPrisma.user.findUniqueOrThrow({ where: { id: c.userId! } });
    expect(u.status).toBe(UserStatus.SUSPENDED);
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
npm test -- tests/lib/server-actions/manager-crud.test.ts
```
Expected: module not found.

- [ ] **Step 3: Implement**

Create `src/lib/server-actions/manager-crud.ts`:
```typescript
import { z } from "zod";
import { PrismaClient, Role, User, UserStatus } from "@prisma/client";
import { tenantPrisma } from "@/lib/prisma-tenant";
import { generateActivationToken } from "@/lib/activation-token";

const ManagerSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  email: z.string().email("Email invalide"),
  phone: z.string().min(5, "Téléphone requis"),
});

export interface CreateManagerInput {
  tenantId: string;
  gymId: string;
  name: string;
  email: string;
  phone: string;
  prisma: PrismaClient;
  appUrl?: string;
}

export async function createManager(
  input: CreateManagerInput
): Promise<{ success: boolean; userId?: string; activationUrl?: string; error?: string }> {
  const parsed = ManagerSchema.safeParse({ name: input.name, email: input.email, phone: input.phone });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await input.prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { success: false, error: "Cet email est déjà utilisé" };
  }

  // Verify gym belongs to tenant
  const scoped = tenantPrisma(input.prisma, input.tenantId);
  const gym = await scoped.gym.findUnique({ where: { id: input.gymId } });
  if (!gym) {
    return { success: false, error: "Salle introuvable dans cette organisation" };
  }

  const { token, expiresAt } = generateActivationToken();
  const user = await scoped.user.create({
    data: {
      name: parsed.data.name,
      email,
      phone: parsed.data.phone,
      passwordHash: null,
      role: Role.MANAGER,
      status: UserStatus.PENDING,
      gymId: input.gymId,
      activationToken: token,
      activationTokenExpiresAt: expiresAt,
    },
  });

  const appUrl = input.appUrl ?? process.env.APP_URL ?? "http://localhost:3000";
  const activationUrl = `${appUrl}/activate?token=${token}`;
  return { success: true, userId: user.id, activationUrl };
}

export interface ListManagersInput {
  tenantId: string;
  prisma: PrismaClient;
}

export async function listManagers(input: ListManagersInput): Promise<User[]> {
  const scoped = tenantPrisma(input.prisma, input.tenantId);
  return scoped.user.findMany({
    where: { role: Role.MANAGER },
    orderBy: { name: "asc" },
  });
}

export interface DeactivateManagerInput {
  tenantId: string;
  managerId: string;
  prisma: PrismaClient;
}

export async function deactivateManager(input: DeactivateManagerInput): Promise<{ success: boolean; error?: string }> {
  const scoped = tenantPrisma(input.prisma, input.tenantId);
  try {
    await scoped.user.update({
      where: { id: input.managerId },
      data: { status: UserStatus.SUSPENDED },
    });
    return { success: true };
  } catch {
    return { success: false, error: "Manager introuvable" };
  }
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
npm test -- tests/lib/server-actions/manager-crud.test.ts
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add manager CRUD server actions with activation flow"
```

---

## Task 4: Plan (formula) CRUD server actions (TDD)

**Files:**
- Create: `src/lib/server-actions/plan-crud.ts`, `tests/lib/server-actions/plan-crud.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/lib/server-actions/plan-crud.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, resetDb } from "../../helpers/db";
import { createPlan, listPlans, updatePlan, deactivatePlan } from "@/lib/server-actions/plan-crud";
import { TenantStatus } from "@prisma/client";

async function seed() {
  const t = await testPrisma.tenant.create({
    data: { name: "F", slug: "f", ownerEmail: "a@x.com", ownerPhone: "1", city: "Dakar", status: TenantStatus.ACTIVE },
  });
  const g = await testPrisma.gym.create({
    data: { tenantId: t.id, name: "G1", address: "x", city: "x", phone: "1", latitude: 14.7, longitude: -17.4 },
  });
  return { t, g };
}

describe("createPlan", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("creates a plan scoped to tenant + gym", async () => {
    const { t, g } = await seed();
    const r = await createPlan({
      tenantId: t.id, gymId: g.id,
      name: "Mensuel", durationDays: 30, price: 25000,
      prisma: testPrisma,
    });
    expect(r.success).toBe(true);
    const plans = await testPrisma.plan.findMany();
    expect(plans).toHaveLength(1);
    expect(plans[0].tenantId).toBe(t.id);
    expect(plans[0].gymId).toBe(g.id);
    expect(plans[0].price).toBe(25000);
    expect(plans[0].currency).toBe("XOF");
  });

  it("rejects zero or negative price", async () => {
    const { t, g } = await seed();
    const r = await createPlan({
      tenantId: t.id, gymId: g.id,
      name: "X", durationDays: 30, price: 0,
      prisma: testPrisma,
    });
    expect(r.success).toBe(false);
  });

  it("rejects gym from another tenant", async () => {
    const { t, g } = await seed();
    const t2 = await testPrisma.tenant.create({
      data: { name: "T2", slug: "t2", ownerEmail: "b@x.com", ownerPhone: "1", city: "x", status: TenantStatus.ACTIVE },
    });
    const r = await createPlan({
      tenantId: t2.id, gymId: g.id,
      name: "X", durationDays: 30, price: 1000,
      prisma: testPrisma,
    });
    expect(r.success).toBe(false);
  });
});

describe("listPlans", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("returns active plans of a gym ordered by durationDays", async () => {
    const { t, g } = await seed();
    await createPlan({ tenantId: t.id, gymId: g.id, name: "Annuel", durationDays: 365, price: 200000, prisma: testPrisma });
    await createPlan({ tenantId: t.id, gymId: g.id, name: "Mensuel", durationDays: 30, price: 25000, prisma: testPrisma });
    const list = await listPlans({ tenantId: t.id, gymId: g.id, prisma: testPrisma });
    expect(list.map(p => p.durationDays)).toEqual([30, 365]);
  });
});

describe("deactivatePlan", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("sets isActive=false (soft delete)", async () => {
    const { t, g } = await seed();
    const c = await createPlan({ tenantId: t.id, gymId: g.id, name: "Mensuel", durationDays: 30, price: 25000, prisma: testPrisma });
    const r = await deactivatePlan({ tenantId: t.id, planId: c.planId!, prisma: testPrisma });
    expect(r.success).toBe(true);
    const p = await testPrisma.plan.findUniqueOrThrow({ where: { id: c.planId! } });
    expect(p.isActive).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
npm test -- tests/lib/server-actions/plan-crud.test.ts
```
Expected: module not found.

- [ ] **Step 3: Implement**

Create `src/lib/server-actions/plan-crud.ts`:
```typescript
import { z } from "zod";
import { PrismaClient, Plan } from "@prisma/client";
import { tenantPrisma } from "@/lib/prisma-tenant";

const PlanSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  durationDays: z.number().int().positive("Durée invalide"),
  price: z.number().int().positive("Prix invalide"),
  currency: z.string().default("XOF"),
});

const PlanUpdateSchema = PlanSchema.partial();

export interface CreatePlanInput {
  tenantId: string;
  gymId: string;
  name: string;
  durationDays: number;
  price: number;
  currency?: string;
  prisma: PrismaClient;
}

export async function createPlan(input: CreatePlanInput): Promise<{ success: boolean; planId?: string; error?: string }> {
  const parsed = PlanSchema.safeParse({
    name: input.name, durationDays: input.durationDays,
    price: input.price, currency: input.currency,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const scoped = tenantPrisma(input.prisma, input.tenantId);
  const gym = await scoped.gym.findUnique({ where: { id: input.gymId } });
  if (!gym) return { success: false, error: "Salle introuvable dans cette organisation" };

  const plan = await scoped.plan.create({
    data: { gymId: input.gymId, ...parsed.data },
  });
  return { success: true, planId: plan.id };
}

export interface ListPlansInput {
  tenantId: string;
  gymId: string;
  prisma: PrismaClient;
  includeInactive?: boolean;
}

export async function listPlans(input: ListPlansInput): Promise<Plan[]> {
  const scoped = tenantPrisma(input.prisma, input.tenantId);
  return scoped.plan.findMany({
    where: {
      gymId: input.gymId,
      ...(input.includeInactive ? {} : { isActive: true }),
    },
    orderBy: { durationDays: "asc" },
  });
}

export interface UpdatePlanInput {
  tenantId: string;
  planId: string;
  name?: string;
  durationDays?: number;
  price?: number;
  prisma: PrismaClient;
}

export async function updatePlan(input: UpdatePlanInput): Promise<{ success: boolean; error?: string }> {
  const parsed = PlanUpdateSchema.safeParse({
    name: input.name, durationDays: input.durationDays, price: input.price,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const scoped = tenantPrisma(input.prisma, input.tenantId);
  try {
    await scoped.plan.update({ where: { id: input.planId }, data: parsed.data });
    return { success: true };
  } catch {
    return { success: false, error: "Formule introuvable" };
  }
}

export interface DeactivatePlanInput {
  tenantId: string;
  planId: string;
  prisma: PrismaClient;
}

export async function deactivatePlan(input: DeactivatePlanInput): Promise<{ success: boolean; error?: string }> {
  const scoped = tenantPrisma(input.prisma, input.tenantId);
  try {
    await scoped.plan.update({ where: { id: input.planId }, data: { isActive: false } });
    return { success: true };
  } catch {
    return { success: false, error: "Formule introuvable" };
  }
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
npm test -- tests/lib/server-actions/plan-crud.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add plan (formula) CRUD server actions"
```

---

## Task 5: Photo upload helper

**Files:**
- Modify: `package.json` (add `sharp`, `file-type`)
- Modify: `.gitignore` (ignore `public/uploads/`)
- Create: `src/lib/upload.ts`

- [ ] **Step 1: Install deps**

```bash
cd /Users/admin/gym-management
npm install sharp file-type
```

- [ ] **Step 2: Update .gitignore**

Append to `.gitignore`:
```
# user uploads (local MVP storage)
/public/uploads/
```

Create the directory + a `.gitkeep`:
```bash
mkdir -p public/uploads
touch public/uploads/.gitkeep
```

Then make sure `.gitkeep` is NOT ignored — modify the line above to:
```
/public/uploads/*
!/public/uploads/.gitkeep
```

- [ ] **Step 3: Implement upload helper**

Create `src/lib/upload.ts`:
```typescript
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const RESIZE_WIDTH = 512;

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export async function saveAvatar(buffer: Buffer): Promise<UploadResult> {
  if (buffer.length > MAX_BYTES) {
    return { success: false, error: "Image trop volumineuse (5 Mo max)" };
  }

  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !ALLOWED_MIME.has(detected.mime)) {
    return { success: false, error: "Format non supporté (JPEG/PNG/WebP uniquement)" };
  }

  const resized = await sharp(buffer)
    .resize({ width: RESIZE_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${crypto.randomBytes(16).toString("hex")}.jpg`;
  await fs.writeFile(path.join(UPLOAD_DIR, filename), resized);

  return { success: true, url: `/uploads/${filename}` };
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add avatar upload helper (resize + validation)"
```

---

## Task 6: Member CRUD server actions (TDD)

**Files:**
- Create: `src/lib/server-actions/member-crud.ts`, `tests/lib/server-actions/member-crud.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/lib/server-actions/member-crud.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, resetDb } from "../../helpers/db";
import { createMember, listMembers, getMember, updateMember } from "@/lib/server-actions/member-crud";
import { Role, TenantStatus, UserStatus } from "@prisma/client";

async function seed() {
  const t = await testPrisma.tenant.create({
    data: { name: "F", slug: "f", ownerEmail: "a@x.com", ownerPhone: "1", city: "x", status: TenantStatus.ACTIVE },
  });
  return { t };
}

describe("createMember", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("creates a MEMBER ACTIVE with passwordless account", async () => {
    const { t } = await seed();
    const r = await createMember({
      tenantId: t.id,
      name: "Aliou", email: "aliou@x.com", phone: "+221770000000",
      avatar: "/uploads/avatar1.jpg",
      prisma: testPrisma,
    });
    expect(r.success).toBe(true);
    const u = await testPrisma.user.findUniqueOrThrow({ where: { email: "aliou@x.com" } });
    expect(u.role).toBe(Role.MEMBER);
    expect(u.status).toBe(UserStatus.ACTIVE);
    expect(u.tenantId).toBe(t.id);
    expect(u.avatar).toBe("/uploads/avatar1.jpg");
    expect(u.activationToken).not.toBeNull();
  });

  it("rejects without avatar (required for anti-fraud)", async () => {
    const { t } = await seed();
    const r = await createMember({
      tenantId: t.id,
      name: "Aliou", email: "a@x.com", phone: "+221770000000",
      avatar: "",
      prisma: testPrisma,
    });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/photo|avatar/i);
  });

  it("rejects duplicate email", async () => {
    const { t } = await seed();
    await createMember({
      tenantId: t.id, name: "A", email: "a@x.com", phone: "1",
      avatar: "/uploads/x.jpg", prisma: testPrisma,
    });
    const r = await createMember({
      tenantId: t.id, name: "B", email: "a@x.com", phone: "2",
      avatar: "/uploads/y.jpg", prisma: testPrisma,
    });
    expect(r.success).toBe(false);
  });
});

describe("listMembers", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("returns members of a tenant only", async () => {
    const { t } = await seed();
    await createMember({ tenantId: t.id, name: "Beta", email: "b@x.com", phone: "1", avatar: "/uploads/b.jpg", prisma: testPrisma });
    await createMember({ tenantId: t.id, name: "Alpha", email: "a@x.com", phone: "2", avatar: "/uploads/a.jpg", prisma: testPrisma });
    const list = await listMembers({ tenantId: t.id, prisma: testPrisma });
    expect(list.map(m => m.name)).toEqual(["Alpha", "Beta"]);
  });

  it("filters by search query (name / email / phone)", async () => {
    const { t } = await seed();
    await createMember({ tenantId: t.id, name: "Aliou Diop", email: "aliou@x.com", phone: "+221770000001", avatar: "/uploads/a.jpg", prisma: testPrisma });
    await createMember({ tenantId: t.id, name: "Fatou Ndiaye", email: "fatou@x.com", phone: "+221770000002", avatar: "/uploads/b.jpg", prisma: testPrisma });
    const r = await listMembers({ tenantId: t.id, search: "fatou", prisma: testPrisma });
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe("Fatou Ndiaye");
  });
});

describe("getMember", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("returns null when member not in tenant", async () => {
    const { t } = await seed();
    const t2 = await testPrisma.tenant.create({
      data: { name: "T2", slug: "t2", ownerEmail: "b@x.com", ownerPhone: "1", city: "x", status: TenantStatus.ACTIVE },
    });
    const c = await createMember({
      tenantId: t2.id, name: "X", email: "x@x.com", phone: "1",
      avatar: "/uploads/x.jpg", prisma: testPrisma,
    });
    const r = await getMember({ tenantId: t.id, memberId: c.userId!, prisma: testPrisma });
    expect(r).toBeNull();
  });
});

describe("updateMember", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("updates name + phone", async () => {
    const { t } = await seed();
    const c = await createMember({
      tenantId: t.id, name: "A", email: "a@x.com", phone: "1",
      avatar: "/uploads/a.jpg", prisma: testPrisma,
    });
    const r = await updateMember({
      tenantId: t.id, memberId: c.userId!,
      name: "Aliou Diop", phone: "+221770000099",
      prisma: testPrisma,
    });
    expect(r.success).toBe(true);
    const u = await testPrisma.user.findUniqueOrThrow({ where: { id: c.userId! } });
    expect(u.name).toBe("Aliou Diop");
    expect(u.phone).toBe("+221770000099");
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
npm test -- tests/lib/server-actions/member-crud.test.ts
```

- [ ] **Step 3: Implement**

Create `src/lib/server-actions/member-crud.ts`:
```typescript
import { z } from "zod";
import { PrismaClient, Role, User, UserStatus } from "@prisma/client";
import { tenantPrisma } from "@/lib/prisma-tenant";
import { generateActivationToken } from "@/lib/activation-token";

const MemberSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  email: z.string().email("Email invalide"),
  phone: z.string().min(5, "Téléphone requis"),
  avatar: z.string().min(1, "Photo membre requise pour l'anti-fraude"),
});

const MemberUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(5).optional(),
  avatar: z.string().min(1).optional(),
});

export interface CreateMemberInput {
  tenantId: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  prisma: PrismaClient;
  appUrl?: string;
}

export async function createMember(
  input: CreateMemberInput
): Promise<{ success: boolean; userId?: string; activationUrl?: string; error?: string }> {
  const parsed = MemberSchema.safeParse({
    name: input.name, email: input.email, phone: input.phone, avatar: input.avatar,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await input.prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { success: false, error: "Cet email est déjà utilisé" };
  }

  const { token, expiresAt } = generateActivationToken();
  const scoped = tenantPrisma(input.prisma, input.tenantId);
  const member = await scoped.user.create({
    data: {
      name: parsed.data.name,
      email,
      phone: parsed.data.phone,
      avatar: parsed.data.avatar,
      passwordHash: null,
      role: Role.MEMBER,
      status: UserStatus.ACTIVE,
      activationToken: token,
      activationTokenExpiresAt: expiresAt,
    },
  });

  const appUrl = input.appUrl ?? process.env.APP_URL ?? "http://localhost:3000";
  const activationUrl = `${appUrl}/activate?token=${token}`;
  return { success: true, userId: member.id, activationUrl };
}

export interface ListMembersInput {
  tenantId: string;
  search?: string;
  prisma: PrismaClient;
}

export async function listMembers(input: ListMembersInput): Promise<User[]> {
  const scoped = tenantPrisma(input.prisma, input.tenantId);
  const search = input.search?.trim();
  return scoped.user.findMany({
    where: {
      role: Role.MEMBER,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
  });
}

export interface GetMemberInput {
  tenantId: string;
  memberId: string;
  prisma: PrismaClient;
}

export async function getMember(input: GetMemberInput): Promise<User | null> {
  const scoped = tenantPrisma(input.prisma, input.tenantId);
  const u = await scoped.user.findUnique({ where: { id: input.memberId } });
  if (!u || u.role !== Role.MEMBER) return null;
  return u;
}

export interface UpdateMemberInput {
  tenantId: string;
  memberId: string;
  name?: string;
  phone?: string;
  avatar?: string;
  prisma: PrismaClient;
}

export async function updateMember(input: UpdateMemberInput): Promise<{ success: boolean; error?: string }> {
  const parsed = MemberUpdateSchema.safeParse({
    name: input.name, phone: input.phone, avatar: input.avatar,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const scoped = tenantPrisma(input.prisma, input.tenantId);
  try {
    await scoped.user.update({ where: { id: input.memberId }, data: parsed.data });
    return { success: true };
  } catch {
    return { success: false, error: "Membre introuvable" };
  }
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
npm test -- tests/lib/server-actions/member-crud.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add member CRUD server actions with photo + search"
```

---

## Task 7: Subscription assignment server action (TDD)

**Files:**
- Create: `src/lib/server-actions/subscription-crud.ts`, `tests/lib/server-actions/subscription-crud.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/lib/server-actions/subscription-crud.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, resetDb } from "../../helpers/db";
import { assignSubscription, cancelSubscription } from "@/lib/server-actions/subscription-crud";
import { createMember } from "@/lib/server-actions/member-crud";
import { createPlan } from "@/lib/server-actions/plan-crud";
import { Role, SubscriptionStatus, TenantStatus } from "@prisma/client";

async function seedFull() {
  const t = await testPrisma.tenant.create({
    data: { name: "F", slug: "f", ownerEmail: "a@x.com", ownerPhone: "1", city: "x", status: TenantStatus.ACTIVE },
  });
  const g = await testPrisma.gym.create({
    data: { tenantId: t.id, name: "G1", address: "x", city: "x", phone: "1", latitude: 14.7, longitude: -17.4 },
  });
  const m = await createMember({
    tenantId: t.id, name: "Aliou", email: "a@x.com", phone: "1",
    avatar: "/uploads/a.jpg", prisma: testPrisma,
  });
  const p = await createPlan({
    tenantId: t.id, gymId: g.id, name: "Mensuel", durationDays: 30, price: 25000, prisma: testPrisma,
  });
  return { t, g, memberId: m.userId!, planId: p.planId! };
}

describe("assignSubscription", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("creates ACTIVE subscription with endDate = startDate + durationDays", async () => {
    const { t, memberId, planId } = await seedFull();
    const start = new Date("2026-05-24T00:00:00Z");
    const r = await assignSubscription({
      tenantId: t.id, memberId, planId, startDate: start, prisma: testPrisma,
    });
    expect(r.success).toBe(true);
    const subs = await testPrisma.subscription.findMany();
    expect(subs).toHaveLength(1);
    expect(subs[0].status).toBe(SubscriptionStatus.ACTIVE);
    expect(subs[0].startDate.toISOString()).toBe(start.toISOString());
    const expectedEnd = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
    expect(subs[0].endDate.toISOString()).toBe(expectedEnd.toISOString());
  });

  it("rejects when member not in tenant", async () => {
    const { t, planId } = await seedFull();
    const t2 = await testPrisma.tenant.create({
      data: { name: "T2", slug: "t2", ownerEmail: "b@x.com", ownerPhone: "1", city: "x", status: TenantStatus.ACTIVE },
    });
    const otherMember = await createMember({
      tenantId: t2.id, name: "X", email: "x@x.com", phone: "1",
      avatar: "/uploads/x.jpg", prisma: testPrisma,
    });
    const r = await assignSubscription({
      tenantId: t.id, memberId: otherMember.userId!, planId,
      startDate: new Date(), prisma: testPrisma,
    });
    expect(r.success).toBe(false);
  });

  it("defaults startDate to now when omitted", async () => {
    const { t, memberId, planId } = await seedFull();
    const before = Date.now();
    const r = await assignSubscription({
      tenantId: t.id, memberId, planId, prisma: testPrisma,
    });
    expect(r.success).toBe(true);
    const s = await testPrisma.subscription.findFirstOrThrow();
    expect(s.startDate.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(s.startDate.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });
});

describe("cancelSubscription", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("flips status to CANCELLED", async () => {
    const { t, memberId, planId } = await seedFull();
    const c = await assignSubscription({ tenantId: t.id, memberId, planId, prisma: testPrisma });
    const r = await cancelSubscription({ tenantId: t.id, subscriptionId: c.subscriptionId!, prisma: testPrisma });
    expect(r.success).toBe(true);
    const s = await testPrisma.subscription.findUniqueOrThrow({ where: { id: c.subscriptionId! } });
    expect(s.status).toBe(SubscriptionStatus.CANCELLED);
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
npm test -- tests/lib/server-actions/subscription-crud.test.ts
```

- [ ] **Step 3: Implement**

Create `src/lib/server-actions/subscription-crud.ts`:
```typescript
import { PrismaClient, SubscriptionStatus, Role } from "@prisma/client";
import { tenantPrisma } from "@/lib/prisma-tenant";

export interface AssignSubscriptionInput {
  tenantId: string;
  memberId: string;
  planId: string;
  startDate?: Date;
  autoRenew?: boolean;
  prisma: PrismaClient;
}

export async function assignSubscription(
  input: AssignSubscriptionInput
): Promise<{ success: boolean; subscriptionId?: string; error?: string }> {
  const scoped = tenantPrisma(input.prisma, input.tenantId);

  const member = await scoped.user.findUnique({ where: { id: input.memberId } });
  if (!member || member.role !== Role.MEMBER) {
    return { success: false, error: "Membre introuvable dans cette organisation" };
  }

  const plan = await scoped.plan.findUnique({ where: { id: input.planId } });
  if (!plan) {
    return { success: false, error: "Formule introuvable dans cette organisation" };
  }

  const startDate = input.startDate ?? new Date();
  const endDate = new Date(startDate.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

  const sub = await scoped.subscription.create({
    data: {
      memberId: input.memberId,
      planId: input.planId,
      startDate,
      endDate,
      status: SubscriptionStatus.ACTIVE,
      autoRenew: input.autoRenew ?? false,
    },
  });

  return { success: true, subscriptionId: sub.id };
}

export interface CancelSubscriptionInput {
  tenantId: string;
  subscriptionId: string;
  prisma: PrismaClient;
}

export async function cancelSubscription(
  input: CancelSubscriptionInput
): Promise<{ success: boolean; error?: string }> {
  const scoped = tenantPrisma(input.prisma, input.tenantId);
  try {
    await scoped.subscription.update({
      where: { id: input.subscriptionId },
      data: { status: SubscriptionStatus.CANCELLED },
    });
    return { success: true };
  } catch {
    return { success: false, error: "Abonnement introuvable" };
  }
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
npm test -- tests/lib/server-actions/subscription-crud.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add subscription assign + cancel server actions"
```

---

## Task 8: TENANT_ADMIN gyms management UI

**Files:**
- Modify: `src/components/admin/nav.tsx` (add Gyms link)
- Create: `src/components/admin/gym-form.tsx`, `src/app/admin/gyms/page.tsx`, `src/app/admin/gyms/new/page.tsx`, `src/app/admin/gyms/[id]/page.tsx`, `src/app/admin/gyms/[id]/edit/page.tsx`, `src/app/api/admin/gyms/route.ts`, `src/app/api/admin/gyms/[id]/route.ts`

- [ ] **Step 1: Extend admin nav**

Replace `src/components/admin/nav.tsx`:
```tsx
import Link from "next/link";
import { SignOutButton } from "@/components/platform/sign-out-button";

export function AdminNav() {
  return (
    <nav className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/admin" className="font-semibold text-slate-100">Admin</Link>
        <Link href="/admin" className="text-sm text-slate-400 hover:text-slate-200">Dashboard</Link>
        <Link href="/admin/gyms" className="text-sm text-slate-400 hover:text-slate-200">Salles</Link>
        <Link href="/admin/managers" className="text-sm text-slate-400 hover:text-slate-200">Gérants</Link>
      </div>
      <SignOutButton />
    </nav>
  );
}
```

- [ ] **Step 2: Create reusable gym form**

Create `src/components/admin/gym-form.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface GymFormValues {
  name: string;
  address: string;
  city: string;
  phone: string;
  latitude: string;
  longitude: string;
}

export function GymForm({
  initial,
  submitLabel,
  endpoint,
  method,
  redirectTo,
}: {
  initial?: Partial<GymFormValues>;
  submitLabel: string;
  endpoint: string;
  method: "POST" | "PATCH";
  redirectTo: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<GymFormValues>({
    name: initial?.name ?? "",
    address: initial?.address ?? "",
    city: initial?.city ?? "",
    phone: initial?.phone ?? "",
    latitude: initial?.latitude ?? "",
    longitude: initial?.longitude ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update(field: keyof GymFormValues) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function useMyLocation() {
    setError(null);
    if (!navigator.geolocation) return setError("Géolocalisation non supportée");
    navigator.geolocation.getCurrentPosition(
      (pos) => setForm((f) => ({
        ...f,
        latitude: pos.coords.latitude.toFixed(6),
        longitude: pos.coords.longitude.toFixed(6),
      })),
      (err) => setError(`GPS refusé : ${err.message}`)
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Erreur");
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  const inputCls = "w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100";
  return (
    <form onSubmit={onSubmit} className="space-y-3 max-w-lg">
      <div>
        <label className="block text-sm mb-1 text-slate-300">Nom</label>
        <input className={inputCls} required value={form.name} onChange={update("name")} />
      </div>
      <div>
        <label className="block text-sm mb-1 text-slate-300">Adresse</label>
        <input className={inputCls} required value={form.address} onChange={update("address")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm mb-1 text-slate-300">Ville</label>
          <input className={inputCls} required value={form.city} onChange={update("city")} />
        </div>
        <div>
          <label className="block text-sm mb-1 text-slate-300">Téléphone</label>
          <input className={inputCls} required value={form.phone} onChange={update("phone")} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm mb-1 text-slate-300">Latitude</label>
          <input className={inputCls} required type="number" step="any" value={form.latitude} onChange={update("latitude")} />
        </div>
        <div>
          <label className="block text-sm mb-1 text-slate-300">Longitude</label>
          <input className={inputCls} required type="number" step="any" value={form.longitude} onChange={update("longitude")} />
        </div>
      </div>
      <button type="button" onClick={useMyLocation}
        className="text-sm text-blue-400 hover:text-blue-300">📍 Utiliser ma position</button>

      {error && <p className="text-sm text-red-400">{error}</p>}
      <button type="submit" disabled={loading}
        className="w-full px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-medium">
        {loading ? "..." : submitLabel}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Gyms list page**

Create `src/app/admin/gyms/page.tsx`:
```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { listGyms } from "@/lib/server-actions/gym-crud";

export const dynamic = "force-dynamic";

export default async function GymsList() {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId) redirect("/login");

  const gyms = await listGyms({ tenantId: ctx.tenantId, prisma });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <h1 className="text-2xl font-semibold">Salles ({gyms.length})</h1>
        <Link href="/admin/gyms/new"
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-sm font-medium">+ Ajouter</Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {gyms.length === 0 && (
          <p className="text-slate-500 text-sm">Aucune salle. <Link className="text-blue-400" href="/admin/gyms/new">Ajouter la première</Link>.</p>
        )}
        {gyms.map((g) => (
          <Link key={g.id} href={`/admin/gyms/${g.id}`}
            className="bg-slate-900 border border-slate-800 rounded p-4 hover:border-slate-600">
            <div className="font-medium text-slate-100">{g.name}</div>
            <div className="text-sm text-slate-400">{g.address} — {g.city}</div>
            <div className="text-xs text-slate-500 mt-2 font-mono">QR: {g.qrToken.slice(0, 12)}…</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: New gym page**

Create `src/app/admin/gyms/new/page.tsx`:
```tsx
import { GymForm } from "@/components/admin/gym-form";

export default function NewGymPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">Nouvelle salle</h1>
      <GymForm submitLabel="Créer la salle" endpoint="/api/admin/gyms" method="POST" redirectTo="/admin/gyms" />
    </div>
  );
}
```

- [ ] **Step 5: Gym detail + edit pages**

Create `src/app/admin/gyms/[id]/page.tsx`:
```tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { tenantPrisma } from "@/lib/prisma-tenant";

export const dynamic = "force-dynamic";

export default async function GymDetail({ params }: { params: { id: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId) redirect("/login");

  const scoped = tenantPrisma(prisma, ctx.tenantId);
  const gym = await scoped.gym.findUnique({
    where: { id: params.id },
    include: {
      users: { where: { role: "MANAGER" } },
      plans: { where: { isActive: true }, orderBy: { durationDays: "asc" } },
    },
  });
  if (!gym) notFound();

  return (
    <div className="space-y-6">
      <Link href="/admin/gyms" className="text-sm text-slate-400 hover:text-slate-200">← Salles</Link>
      <div className="flex justify-between items-start">
        <h1 className="text-2xl font-semibold">{gym.name}</h1>
        <Link href={`/admin/gyms/${gym.id}/edit`}
          className="px-3 py-2 rounded border border-slate-700 hover:bg-slate-900 text-sm">Modifier</Link>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded p-4">
          <div className="text-xs text-slate-400 uppercase mb-2">Coordonnées</div>
          <div className="text-sm text-slate-300">{gym.address}</div>
          <div className="text-sm text-slate-400">{gym.city} · {gym.phone}</div>
          <div className="text-xs text-slate-500 mt-2 font-mono">
            {gym.latitude.toFixed(4)}, {gym.longitude.toFixed(4)}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded p-4">
          <div className="text-xs text-slate-400 uppercase mb-2">QR Code (URL de check-in)</div>
          <div className="text-xs text-slate-300 font-mono break-all">
            /checkin?gym={gym.qrToken}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Gérants ({gym.users.length})</h2>
        {gym.users.length === 0
          ? <p className="text-sm text-slate-500">Aucun gérant assigné.</p>
          : <ul className="space-y-1">{gym.users.map(m => (
              <li key={m.id} className="text-sm text-slate-300">{m.name} — {m.email}</li>
            ))}</ul>}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Formules ({gym.plans.length})</h2>
        {gym.plans.length === 0
          ? <p className="text-sm text-slate-500">Aucune formule. Le manager peut en créer.</p>
          : <ul className="space-y-1">{gym.plans.map(p => (
              <li key={p.id} className="text-sm text-slate-300">
                {p.name} — {p.durationDays}j — {p.price.toLocaleString("fr-FR")} {p.currency}
              </li>
            ))}</ul>}
      </div>
    </div>
  );
}
```

Create `src/app/admin/gyms/[id]/edit/page.tsx`:
```tsx
import { notFound, redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { tenantPrisma } from "@/lib/prisma-tenant";
import { GymForm } from "@/components/admin/gym-form";

export const dynamic = "force-dynamic";

export default async function EditGymPage({ params }: { params: { id: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId) redirect("/login");

  const scoped = tenantPrisma(prisma, ctx.tenantId);
  const gym = await scoped.gym.findUnique({ where: { id: params.id } });
  if (!gym) notFound();

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">Modifier {gym.name}</h1>
      <GymForm
        submitLabel="Enregistrer"
        endpoint={`/api/admin/gyms/${gym.id}`}
        method="PATCH"
        redirectTo={`/admin/gyms/${gym.id}`}
        initial={{
          name: gym.name, address: gym.address, city: gym.city, phone: gym.phone,
          latitude: gym.latitude.toString(), longitude: gym.longitude.toString(),
        }}
      />
    </div>
  );
}
```

- [ ] **Step 6: Gyms API routes**

Create `src/app/api/admin/gyms/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createGym } from "@/lib/server-actions/gym-crud";

export async function POST(req: Request) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.TENANT_ADMIN || !ctx.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const r = await createGym({
    tenantId: ctx.tenantId,
    name: String(body.name ?? ""),
    address: String(body.address ?? ""),
    city: String(body.city ?? ""),
    phone: String(body.phone ?? ""),
    latitude: Number(body.latitude),
    longitude: Number(body.longitude),
    prisma,
  });
  if (!r.success) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true, gymId: r.gymId });
}
```

Create `src/app/api/admin/gyms/[id]/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { updateGym, deleteGym } from "@/lib/server-actions/gym-crud";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.TENANT_ADMIN || !ctx.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const r = await updateGym({
    tenantId: ctx.tenantId, gymId: params.id,
    name: body.name, address: body.address, city: body.city, phone: body.phone,
    latitude: body.latitude !== undefined ? Number(body.latitude) : undefined,
    longitude: body.longitude !== undefined ? Number(body.longitude) : undefined,
    prisma,
  });
  if (!r.success) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.TENANT_ADMIN || !ctx.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const r = await deleteGym({ tenantId: ctx.tenantId, gymId: params.id, prisma });
  if (!r.success) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 7: Verify build**

```bash
npm run build
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add TENANT_ADMIN gyms management UI (list/create/detail/edit)"
```

---

## Task 9: TENANT_ADMIN managers UI

**Files:**
- Create: `src/app/admin/managers/page.tsx`, `src/app/admin/managers/new/page.tsx`, `src/app/admin/managers/manager-form.tsx`, `src/app/api/admin/managers/route.ts`, `src/app/api/admin/managers/[id]/deactivate/route.ts`

- [ ] **Step 1: Managers list**

Create `src/app/admin/managers/page.tsx`:
```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { listManagers } from "@/lib/server-actions/manager-crud";
import { listGyms } from "@/lib/server-actions/gym-crud";

export const dynamic = "force-dynamic";

export default async function ManagersList() {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId) redirect("/login");

  const [managers, gyms] = await Promise.all([
    listManagers({ tenantId: ctx.tenantId, prisma }),
    listGyms({ tenantId: ctx.tenantId, prisma }),
  ]);
  const gymById = new Map(gyms.map(g => [g.id, g.name]));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <h1 className="text-2xl font-semibold">Gérants ({managers.length})</h1>
        <Link href="/admin/managers/new"
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-sm font-medium">+ Inviter</Link>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-400 border-b border-slate-800">
            <tr>
              <th className="px-4 py-3 text-left">Nom</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Salle</th>
              <th className="px-4 py-3 text-left">Statut</th>
            </tr>
          </thead>
          <tbody>
            {managers.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Aucun gérant</td></tr>
            )}
            {managers.map((m) => (
              <tr key={m.id} className="border-b border-slate-800 last:border-0">
                <td className="px-4 py-3 text-slate-100">{m.name}</td>
                <td className="px-4 py-3 text-slate-400">{m.email}</td>
                <td className="px-4 py-3 text-slate-400">{m.gymId ? gymById.get(m.gymId) ?? "—" : "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded border ${
                    m.status === "ACTIVE" ? "bg-green-950 text-green-300 border-green-900" :
                    m.status === "PENDING" ? "bg-amber-950 text-amber-300 border-amber-900" :
                    "bg-red-950 text-red-300 border-red-900"
                  }`}>{m.status}</span>
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

- [ ] **Step 2: Manager form (client)**

Create `src/app/admin/managers/manager-form.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ManagerForm({ gyms }: { gyms: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", phone: "", gymId: gyms[0]?.id ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activationUrl, setActivationUrl] = useState<string | null>(null);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/admin/managers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Erreur");
      return;
    }
    const j = await res.json();
    if (j.activationUrl) {
      setActivationUrl(j.activationUrl);
    } else {
      router.push("/admin/managers");
      router.refresh();
    }
  }

  const inputCls = "w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100";

  if (activationUrl) {
    return (
      <div className="space-y-4">
        <div className="bg-green-950 border border-green-900 rounded p-3 text-green-300 text-sm">
          Gérant créé. Envoyez-lui ce lien d&apos;activation (email envoyé auto si Resend configuré) :
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded p-3 font-mono text-xs text-slate-300 break-all">
          {activationUrl}
        </div>
        <button onClick={() => { router.push("/admin/managers"); router.refresh(); }}
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-sm font-medium">
          Retour à la liste
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 max-w-lg">
      <div>
        <label className="block text-sm mb-1 text-slate-300">Nom du gérant</label>
        <input className={inputCls} required value={form.name} onChange={update("name")} />
      </div>
      <div>
        <label className="block text-sm mb-1 text-slate-300">Email</label>
        <input className={inputCls} type="email" required value={form.email} onChange={update("email")} />
      </div>
      <div>
        <label className="block text-sm mb-1 text-slate-300">Téléphone</label>
        <input className={inputCls} required value={form.phone} onChange={update("phone")} />
      </div>
      <div>
        <label className="block text-sm mb-1 text-slate-300">Salle assignée</label>
        <select className={inputCls} required value={form.gymId} onChange={update("gymId")}>
          {gyms.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button type="submit" disabled={loading || gyms.length === 0}
        className="w-full px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-medium">
        {loading ? "..." : "Inviter le gérant"}
      </button>
      {gyms.length === 0 && (
        <p className="text-sm text-amber-400">Créez d&apos;abord une salle avant d&apos;inviter un gérant.</p>
      )}
    </form>
  );
}
```

- [ ] **Step 3: New manager page**

Create `src/app/admin/managers/new/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { listGyms } from "@/lib/server-actions/gym-crud";
import { ManagerForm } from "../manager-form";

export const dynamic = "force-dynamic";

export default async function NewManagerPage() {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId) redirect("/login");
  const gyms = await listGyms({ tenantId: ctx.tenantId, prisma });

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">Inviter un gérant</h1>
      <ManagerForm gyms={gyms.map(g => ({ id: g.id, name: g.name }))} />
    </div>
  );
}
```

- [ ] **Step 4: Managers API routes**

Create `src/app/api/admin/managers/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createManager } from "@/lib/server-actions/manager-crud";
import { sendEmail, buildActivationEmail } from "@/lib/email";

export async function POST(req: Request) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.TENANT_ADMIN || !ctx.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const r = await createManager({
    tenantId: ctx.tenantId,
    gymId: String(body.gymId ?? ""),
    name: String(body.name ?? ""),
    email: String(body.email ?? ""),
    phone: String(body.phone ?? ""),
    prisma,
  });
  if (!r.success) return NextResponse.json({ error: r.error }, { status: 400 });

  if (r.activationUrl) {
    const email = buildActivationEmail({
      recipientName: String(body.name),
      activationUrl: r.activationUrl,
    });
    await sendEmail({ to: String(body.email).toLowerCase(), ...email });
  }

  return NextResponse.json({ ok: true, userId: r.userId, activationUrl: r.activationUrl });
}
```

Create `src/app/api/admin/managers/[id]/deactivate/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deactivateManager } from "@/lib/server-actions/manager-crud";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.TENANT_ADMIN || !ctx.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const r = await deactivateManager({ tenantId: ctx.tenantId, managerId: params.id, prisma });
  if (!r.success) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Build + commit**

```bash
npm run build
git add -A
git commit -m "feat: add TENANT_ADMIN managers UI (list + invite with activation)"
```

---

## Task 10: MANAGER dashboard + nav

**Files:**
- Create: `src/components/manager/nav.tsx`, `src/app/manager/layout.tsx`, `src/app/manager/page.tsx`

- [ ] **Step 1: Manager nav**

Create `src/components/manager/nav.tsx`:
```tsx
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
      </div>
      <SignOutButton />
    </nav>
  );
}
```

- [ ] **Step 2: Manager layout**

Create `src/app/manager/layout.tsx`:
```tsx
import { ManagerNav } from "@/components/manager/nav";

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <ManagerNav />
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Manager dashboard home**

Create `src/app/manager/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { tenantPrisma } from "@/lib/prisma-tenant";
import { SubscriptionStatus, Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function ManagerDashboard() {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId || !ctx.gymId) redirect("/login");

  const scoped = tenantPrisma(prisma, ctx.tenantId);
  const gym = await scoped.gym.findUnique({ where: { id: ctx.gymId } });
  if (!gym) redirect("/login");

  const [memberCount, activeSubs, plans] = await Promise.all([
    scoped.user.count({ where: { role: Role.MEMBER } }),
    scoped.subscription.count({ where: { status: SubscriptionStatus.ACTIVE } }),
    scoped.plan.count({ where: { gymId: ctx.gymId, isActive: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{gym.name}</h1>
        <p className="text-sm text-slate-400">{gym.address}, {gym.city}</p>
      </div>
      <div className="grid grid-cols-3 gap-4">
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
      </div>
      <div className="text-sm text-slate-400">
        Le dashboard temps réel des check-ins arrive dans le plan suivant.
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
npm run build
git add -A
git commit -m "feat: add MANAGER dashboard with gym stats"
```

---

## Task 11: MANAGER plans (formulas) UI

**Files:**
- Create: `src/components/manager/plan-form.tsx`, `src/app/manager/plans/page.tsx`, `src/app/manager/plans/new/page.tsx`, `src/app/api/manager/plans/route.ts`, `src/app/api/manager/plans/[id]/route.ts`

- [ ] **Step 1: Plan form (client)**

Create `src/components/manager/plan-form.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PlanForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", durationDays: "30", price: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/manager/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        durationDays: parseInt(form.durationDays, 10),
        price: parseInt(form.price, 10),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Erreur");
      return;
    }
    router.push("/manager/plans");
    router.refresh();
  }

  const inputCls = "w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100";
  return (
    <form onSubmit={onSubmit} className="space-y-3 max-w-md">
      <div>
        <label className="block text-sm mb-1 text-slate-300">Nom (ex: Mensuel, Trimestriel)</label>
        <input className={inputCls} required value={form.name} onChange={update("name")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm mb-1 text-slate-300">Durée (jours)</label>
          <input className={inputCls} required type="number" min="1" value={form.durationDays} onChange={update("durationDays")} />
        </div>
        <div>
          <label className="block text-sm mb-1 text-slate-300">Prix (XOF)</label>
          <input className={inputCls} required type="number" min="1" value={form.price} onChange={update("price")} />
        </div>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button type="submit" disabled={loading}
        className="w-full px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-medium">
        {loading ? "..." : "Créer la formule"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Plans list page**

Create `src/app/manager/plans/page.tsx`:
```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { listPlans } from "@/lib/server-actions/plan-crud";

export const dynamic = "force-dynamic";

export default async function PlansList() {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId || !ctx.gymId) redirect("/login");

  const plans = await listPlans({ tenantId: ctx.tenantId, gymId: ctx.gymId, prisma, includeInactive: true });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <h1 className="text-2xl font-semibold">Formules ({plans.length})</h1>
        <Link href="/manager/plans/new"
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-sm font-medium">+ Ajouter</Link>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-400 border-b border-slate-800">
            <tr>
              <th className="px-4 py-3 text-left">Formule</th>
              <th className="px-4 py-3 text-left">Durée</th>
              <th className="px-4 py-3 text-left">Prix</th>
              <th className="px-4 py-3 text-left">Statut</th>
            </tr>
          </thead>
          <tbody>
            {plans.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Aucune formule</td></tr>
            )}
            {plans.map((p) => (
              <tr key={p.id} className="border-b border-slate-800 last:border-0">
                <td className="px-4 py-3 text-slate-100">{p.name}</td>
                <td className="px-4 py-3 text-slate-400">{p.durationDays} jours</td>
                <td className="px-4 py-3 text-slate-300">{p.price.toLocaleString("fr-FR")} {p.currency}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded border ${
                    p.isActive ? "bg-green-950 text-green-300 border-green-900" : "bg-slate-800 text-slate-400 border-slate-700"
                  }`}>{p.isActive ? "Active" : "Désactivée"}</span>
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

- [ ] **Step 3: New plan page**

Create `src/app/manager/plans/new/page.tsx`:
```tsx
import { PlanForm } from "@/components/manager/plan-form";

export default function NewPlanPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">Nouvelle formule</h1>
      <PlanForm />
    </div>
  );
}
```

- [ ] **Step 4: Plans API routes**

Create `src/app/api/manager/plans/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createPlan } from "@/lib/server-actions/plan-crud";

export async function POST(req: Request) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.MANAGER || !ctx.tenantId || !ctx.gymId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const r = await createPlan({
    tenantId: ctx.tenantId, gymId: ctx.gymId,
    name: String(body.name ?? ""),
    durationDays: Number(body.durationDays),
    price: Number(body.price),
    prisma,
  });
  if (!r.success) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true, planId: r.planId });
}
```

Create `src/app/api/manager/plans/[id]/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { updatePlan, deactivatePlan } from "@/lib/server-actions/plan-crud";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.MANAGER || !ctx.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const r = await updatePlan({
    tenantId: ctx.tenantId, planId: params.id,
    name: body.name, durationDays: body.durationDays !== undefined ? Number(body.durationDays) : undefined,
    price: body.price !== undefined ? Number(body.price) : undefined,
    prisma,
  });
  if (!r.success) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.MANAGER || !ctx.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const r = await deactivatePlan({ tenantId: ctx.tenantId, planId: params.id, prisma });
  if (!r.success) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Build + commit**

```bash
npm run build
git add -A
git commit -m "feat: add MANAGER plans (formulas) UI"
```

---

## Task 12: Upload API route

**Files:**
- Create: `src/app/api/upload/route.ts`

- [ ] **Step 1: Implement**

Create `src/app/api/upload/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { saveAvatar } from "@/lib/upload";

export async function POST(req: Request) {
  const ctx = await getCurrentAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Aucun fichier" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const r = await saveAvatar(buffer);
  if (!r.success) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true, url: r.url });
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add upload API route for avatars"
```

---

## Task 13: MANAGER members UI (list, create with photo, detail, assign subscription)

**Files:**
- Create: `src/components/manager/member-form.tsx`, `src/components/manager/subscription-assign.tsx`, `src/app/manager/members/page.tsx`, `src/app/manager/members/new/page.tsx`, `src/app/manager/members/[id]/page.tsx`, `src/app/api/manager/members/route.ts`, `src/app/api/manager/members/[id]/route.ts`, `src/app/api/manager/subscriptions/route.ts`

- [ ] **Step 1: Member form (with photo upload)**

Create `src/components/manager/member-form.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MemberForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [avatar, setAvatar] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activationUrl, setActivationUrl] = useState<string | null>(null);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    setUploading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Upload échoué");
      return;
    }
    const j = await res.json();
    setAvatar(j.url);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!avatar) { setError("Photo membre obligatoire"); return; }
    setError(null);
    setLoading(true);
    const res = await fetch("/api/manager/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, avatar }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Erreur");
      return;
    }
    const j = await res.json();
    if (j.activationUrl) {
      setActivationUrl(j.activationUrl);
    } else {
      router.push("/manager/members");
      router.refresh();
    }
  }

  const inputCls = "w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100";

  if (activationUrl) {
    return (
      <div className="space-y-4">
        <div className="bg-green-950 border border-green-900 rounded p-3 text-green-300 text-sm">
          Membre créé. Lien d&apos;activation (envoyé par email si Resend configuré) :
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded p-3 font-mono text-xs text-slate-300 break-all">
          {activationUrl}
        </div>
        <button onClick={() => { router.push("/manager/members"); router.refresh(); }}
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-sm font-medium">
          Retour à la liste
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 max-w-lg">
      <div>
        <label className="block text-sm mb-1 text-slate-300">Photo du membre (obligatoire)</label>
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onFileChange}
          className="text-sm text-slate-300" />
        {uploading && <p className="text-xs text-slate-400 mt-1">Téléversement...</p>}
        {avatar && (
          <div className="mt-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatar} alt="preview" className="w-24 h-24 object-cover rounded" />
          </div>
        )}
      </div>
      <div>
        <label className="block text-sm mb-1 text-slate-300">Nom complet</label>
        <input className={inputCls} required value={form.name} onChange={update("name")} />
      </div>
      <div>
        <label className="block text-sm mb-1 text-slate-300">Email</label>
        <input className={inputCls} type="email" required value={form.email} onChange={update("email")} />
      </div>
      <div>
        <label className="block text-sm mb-1 text-slate-300">Téléphone</label>
        <input className={inputCls} required value={form.phone} onChange={update("phone")} />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button type="submit" disabled={loading || uploading || !avatar}
        className="w-full px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-medium">
        {loading ? "..." : "Créer le membre"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Subscription assign component**

Create `src/components/manager/subscription-assign.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SubscriptionAssign({
  memberId,
  plans,
}: {
  memberId: string;
  plans: Array<{ id: string; name: string; durationDays: number; price: number; currency: string }>;
}) {
  const router = useRouter();
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!planId) return;
    setError(null);
    setLoading(true);
    const res = await fetch("/api/manager/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, planId }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Erreur");
      return;
    }
    router.refresh();
  }

  if (plans.length === 0) {
    return <p className="text-sm text-amber-400">Aucune formule active. Créez-en une d&apos;abord.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 flex items-end gap-2 flex-wrap">
      <div className="flex-1 min-w-[200px]">
        <label className="block text-sm mb-1 text-slate-300">Formule</label>
        <select value={planId} onChange={(e) => setPlanId(e.target.value)}
          className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100">
          {plans.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.durationDays}j — {p.price.toLocaleString("fr-FR")} {p.currency}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={loading}
        className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium">
        {loading ? "..." : "Attribuer"}
      </button>
      {error && <p className="text-sm text-red-400 w-full">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 3: Members list**

Create `src/app/manager/members/page.tsx`:
```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { listMembers } from "@/lib/server-actions/member-crud";

export const dynamic = "force-dynamic";

export default async function MembersList({ searchParams }: { searchParams: { q?: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId) redirect("/login");
  const search = searchParams.q ?? "";
  const members = await listMembers({ tenantId: ctx.tenantId, search, prisma });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <h1 className="text-2xl font-semibold">Membres ({members.length})</h1>
        <Link href="/manager/members/new"
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-sm font-medium">+ Ajouter</Link>
      </div>

      <form className="flex gap-2">
        <input name="q" defaultValue={search} placeholder="Rechercher nom, email, téléphone…"
          className="flex-1 px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100 text-sm" />
        <button className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-sm">Rechercher</button>
      </form>

      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-400 border-b border-slate-800">
            <tr>
              <th className="px-4 py-3 text-left">Photo</th>
              <th className="px-4 py-3 text-left">Nom</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Téléphone</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Aucun membre</td></tr>
            )}
            {members.map((m) => (
              <tr key={m.id} className="border-b border-slate-800 last:border-0">
                <td className="px-4 py-3">
                  {m.avatar
                    /* eslint-disable-next-line @next/next/no-img-element */
                    ? <img src={m.avatar} alt={m.name} className="w-10 h-10 object-cover rounded" />
                    : <div className="w-10 h-10 bg-slate-800 rounded" />}
                </td>
                <td className="px-4 py-3 text-slate-100">{m.name}</td>
                <td className="px-4 py-3 text-slate-400">{m.email}</td>
                <td className="px-4 py-3 text-slate-400">{m.phone}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/manager/members/${m.id}`} className="text-blue-400 hover:text-blue-300">Voir →</Link>
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

- [ ] **Step 4: New member page**

Create `src/app/manager/members/new/page.tsx`:
```tsx
import { MemberForm } from "@/components/manager/member-form";

export default function NewMemberPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">Nouveau membre</h1>
      <MemberForm />
    </div>
  );
}
```

- [ ] **Step 5: Member detail page (with subscription history + assign)**

Create `src/app/manager/members/[id]/page.tsx`:
```tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { tenantPrisma } from "@/lib/prisma-tenant";
import { listPlans } from "@/lib/server-actions/plan-crud";
import { SubscriptionAssign } from "@/components/manager/subscription-assign";

export const dynamic = "force-dynamic";

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

  const plans = await listPlans({ tenantId: ctx.tenantId, gymId: ctx.gymId, prisma });

  return (
    <div className="space-y-6">
      <Link href="/manager/members" className="text-sm text-slate-400 hover:text-slate-200">← Membres</Link>
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
        {member.subscriptions.length === 0
          ? <p className="text-sm text-slate-500">Aucun abonnement.</p>
          : (
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
                {member.subscriptions.map(s => (
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
        <h2 className="text-lg font-semibold mb-3">Attribuer un nouvel abonnement</h2>
        <SubscriptionAssign
          memberId={member.id}
          plans={plans.map(p => ({
            id: p.id, name: p.name, durationDays: p.durationDays,
            price: p.price, currency: p.currency,
          }))}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Members + subscription API routes**

Create `src/app/api/manager/members/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createMember } from "@/lib/server-actions/member-crud";
import { sendEmail, buildActivationEmail } from "@/lib/email";

export async function POST(req: Request) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.MANAGER || !ctx.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const r = await createMember({
    tenantId: ctx.tenantId,
    name: String(body.name ?? ""),
    email: String(body.email ?? ""),
    phone: String(body.phone ?? ""),
    avatar: String(body.avatar ?? ""),
    prisma,
  });
  if (!r.success) return NextResponse.json({ error: r.error }, { status: 400 });

  if (r.activationUrl) {
    const email = buildActivationEmail({
      recipientName: String(body.name),
      activationUrl: r.activationUrl,
    });
    await sendEmail({ to: String(body.email).toLowerCase(), ...email });
  }

  return NextResponse.json({ ok: true, userId: r.userId, activationUrl: r.activationUrl });
}
```

Create `src/app/api/manager/members/[id]/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { updateMember } from "@/lib/server-actions/member-crud";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.MANAGER || !ctx.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const r = await updateMember({
    tenantId: ctx.tenantId, memberId: params.id,
    name: body.name, phone: body.phone, avatar: body.avatar, prisma,
  });
  if (!r.success) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
```

Create `src/app/api/manager/subscriptions/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assignSubscription } from "@/lib/server-actions/subscription-crud";

export async function POST(req: Request) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.MANAGER || !ctx.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const r = await assignSubscription({
    tenantId: ctx.tenantId,
    memberId: String(body.memberId ?? ""),
    planId: String(body.planId ?? ""),
    prisma,
  });
  if (!r.success) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true, subscriptionId: r.subscriptionId });
}
```

- [ ] **Step 7: Build + commit**

```bash
npm run build
git add -A
git commit -m "feat: add MANAGER members + subscription assignment UI"
```

---

## Task 14: End-to-end verification

- [ ] **Step 1: All tests pass**

```bash
npm test
```
Expected: 47 (previous) + ~20 new = ~67 tests, all PASS.

- [ ] **Step 2: Typecheck + build**

```bash
npm run typecheck
npm run build
```
Expected: success.

- [ ] **Step 3: Manual smoke test**

Reset and seed:
```bash
npm run db:reset
npm run db:seed
npm run dev
```

Full flow:
1. `/signup` → submit org "FitClub Dakar" / aliou@fitclub.sn
2. Login PLATFORM_OWNER → `/platform/tenants` → valider
3. Copy activation URL → set password
4. Login aliou → wizard salle → create gym
5. `/admin/gyms` → see 1 gym → click → see detail
6. `/admin/gyms/new` → add 2nd gym
7. `/admin/managers/new` → invite manager → email "manager@fitclub.sn" assigned to first gym
8. Copy activation URL from form → set password
9. Login manager → `/manager` → see dashboard with stats
10. `/manager/plans/new` → create "Mensuel 30j 25 000 XOF"
11. `/manager/members/new` → upload photo → create member "Fatou"
12. Copy member activation URL (optional, for member account)
13. `/manager/members` → click Fatou → assign subscription "Mensuel"
14. Verify subscription in DB:
    ```bash
    psql gym_management -c "SELECT m.name, p.name, s.status, s.\"endDate\" FROM \"Subscription\" s JOIN \"User\" m ON m.id = s.\"memberId\" JOIN \"Plan\" p ON p.id = s.\"planId\";"
    ```

- [ ] **Step 4: Final commit**

```bash
git add -A
git status
git commit -m "chore: tenant + manager dashboards milestone" || true
```

---

## Done criteria

- [ ] All tests pass (~67 total)
- [ ] `npm run build` succeeds
- [ ] `npm run typecheck` passes
- [ ] Manual flow: TENANT_ADMIN adds gym + manager; MANAGER creates plan + member with photo + assigns subscription

## What's next (Plan 4)

Payments:
- Wave / Orange Money / PayDunya adapters
- Manual payment recording (cash/TPE) by MANAGER
- Payment history per subscription
- Invoice generation
- Pay-to-renew flow for members
