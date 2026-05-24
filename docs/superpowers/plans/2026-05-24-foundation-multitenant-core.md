# Foundation + Multi-tenant Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up Next.js 14 + PostgreSQL + Prisma + NextAuth foundation with bulletproof multi-tenant isolation enforced at the ORM layer.

**Architecture:** Next.js 14 App Router (TypeScript) backed by PostgreSQL via Prisma. NextAuth handles authentication with 4 roles (PLATFORM_OWNER, TENANT_ADMIN, MANAGER, MEMBER). Tenant isolation enforced by Prisma extension that injects `tenantId` filter on every query unless explicitly bypassed by PLATFORM_OWNER context. Next.js middleware protects routes by role.

**Tech Stack:** Next.js 14, TypeScript, PostgreSQL, Prisma, NextAuth.js, bcrypt, Vitest, Tailwind CSS, shadcn/ui

**Prerequisite:** PostgreSQL 15+ installed locally and running on `localhost:5432`.

---

## File Structure

```
gym-management/
├── package.json
├── tsconfig.json
├── next.config.mjs
├── tailwind.config.ts
├── postcss.config.mjs
├── vitest.config.ts
├── .env.example
├── .env.local                       # gitignored
├── .gitignore
├── prisma/
│   ├── schema.prisma                # DB schema (Tenant, User, Gym)
│   └── seed.ts                      # Seed PLATFORM_OWNER
├── src/
│   ├── app/
│   │   ├── layout.tsx               # Root layout
│   │   ├── page.tsx                 # Landing
│   │   ├── globals.css              # Tailwind
│   │   ├── login/page.tsx           # Login form
│   │   └── api/auth/[...nextauth]/route.ts
│   ├── lib/
│   │   ├── prisma.ts                # Prisma client singleton
│   │   ├── prisma-tenant.ts         # Tenant-scoped client factory
│   │   ├── auth.ts                  # NextAuth config
│   │   ├── auth-context.ts          # getCurrentUser() helper
│   │   └── password.ts              # bcrypt hash/verify
│   ├── middleware.ts                # Route protection
│   └── types/
│       ├── next-auth.d.ts           # Session typing
│       └── roles.ts                 # Role enum + helpers
└── tests/
    ├── lib/
    │   ├── prisma-tenant.test.ts    # Isolation tests
    │   ├── password.test.ts
    │   └── auth-context.test.ts
    └── helpers/
        └── db.ts                    # Test DB setup/teardown
```

---

## Task 1: Initialize Next.js project + base dependencies

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `.gitignore`, `tailwind.config.ts`, `postcss.config.mjs`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

- [ ] **Step 1: Initialize Next.js project**

Run from `/Users/admin/gym-management/`:
```bash
npx create-next-app@14 . --typescript --tailwind --app --src-dir --import-alias "@/*" --no-eslint --use-npm
```
When prompted "Would you like to use Turbopack for next dev?" answer **No**.

Expected: project files created. If it complains the directory is not empty, run with `--force`.

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install @prisma/client next-auth bcryptjs zod
npm install -D prisma @types/bcryptjs vitest @vitest/ui tsx dotenv-cli
```

- [ ] **Step 3: Verify it boots**

```bash
npm run dev
```
Expected: server starts on http://localhost:3000, default Next.js page renders. Kill the server (Ctrl+C).

- [ ] **Step 4: Add .env.example**

Create `.env.example`:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/gym_management?schema=public"
DATABASE_URL_TEST="postgresql://postgres:postgres@localhost:5432/gym_management_test?schema=public"
NEXTAUTH_SECRET="change-me-generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"
```

Copy to `.env.local`:
```bash
cp .env.example .env.local
```

Then generate a real secret:
```bash
openssl rand -base64 32
```
Paste the output as `NEXTAUTH_SECRET` value in `.env.local`.

- [ ] **Step 5: Ensure .env.local is gitignored**

Confirm `.gitignore` contains `.env*.local` (Next.js default does). If not, append it.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: init Next.js 14 + base dependencies"
```

---

## Task 2: Create databases

**Files:** none (manual DB setup)

- [ ] **Step 1: Create dev database**

```bash
createdb gym_management
```
Expected: no output on success. If `createdb` is missing, use `psql -U postgres -c "CREATE DATABASE gym_management;"`.

- [ ] **Step 2: Create test database**

```bash
createdb gym_management_test
```

- [ ] **Step 3: Verify connection**

```bash
psql gym_management -c "SELECT version();"
```
Expected: PostgreSQL 15+ version string printed.

---

## Task 3: Define Prisma schema (Tenant, User, Gym)

**Files:**
- Create: `prisma/schema.prisma`, `src/types/roles.ts`

- [ ] **Step 1: Initialize Prisma**

```bash
npx prisma init --datasource-provider postgresql
```
Expected: `prisma/schema.prisma` and `.env` created. Delete the auto-created `.env` (we use `.env.local`):
```bash
rm .env
```

- [ ] **Step 2: Write the schema**

Replace `prisma/schema.prisma` with:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  PLATFORM_OWNER
  TENANT_ADMIN
  MANAGER
  MEMBER
}

enum UserStatus {
  PENDING
  ACTIVE
  SUSPENDED
}

enum TenantStatus {
  PENDING
  ACTIVE
  SUSPENDED
  REJECTED
}

enum BillingStatus {
  TRIAL
  ACTIVE
  OVERDUE
  SUSPENDED
}

model Tenant {
  id                    String        @id @default(cuid())
  name                  String
  slug                  String        @unique
  ownerEmail            String
  ownerPhone            String
  city                  String
  status                TenantStatus  @default(PENDING)
  isBeta                Boolean       @default(false)
  trialEndsAt           DateTime?
  monthlyPricePerGym    Int           @default(25000)
  billingStatus         BillingStatus @default(TRIAL)
  nextBillingDate       DateTime?
  validatedAt           DateTime?
  validatedById         String?
  rejectionReason       String?
  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt

  users                 User[]
  gyms                  Gym[]
  validatedBy           User?         @relation("TenantValidator", fields: [validatedById], references: [id])

  @@index([status])
  @@index([slug])
}

model User {
  id            String     @id @default(cuid())
  name          String
  email         String     @unique
  phone         String?
  passwordHash  String
  avatar        String?
  role          Role
  status        UserStatus @default(ACTIVE)
  tenantId      String?
  gymId         String?
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  tenant        Tenant?    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  gym           Gym?       @relation(fields: [gymId], references: [id], onDelete: SetNull)
  validatedTenants Tenant[] @relation("TenantValidator")

  @@index([tenantId])
  @@index([gymId])
  @@index([role])
}

model Gym {
  id          String   @id @default(cuid())
  tenantId    String
  name        String
  address     String
  city        String
  phone       String
  logo        String?
  latitude    Float
  longitude   Float
  qrToken     String   @unique @default(cuid())
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  users       User[]

  @@index([tenantId])
  @@index([qrToken])
}
```

- [ ] **Step 3: Run first migration**

```bash
npx dotenv -e .env.local -- npx prisma migrate dev --name init
```
Expected: migration created in `prisma/migrations/`, applied to `gym_management` DB. Prisma Client generated.

- [ ] **Step 4: Apply migration to test DB**

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/gym_management_test?schema=public" npx prisma migrate deploy
```
Expected: migrations applied to test DB.

- [ ] **Step 5: Create roles helper**

Create `src/types/roles.ts`:
```typescript
import { Role } from "@prisma/client";

export { Role };

export const isPlatformOwner = (role: Role): boolean => role === Role.PLATFORM_OWNER;
export const isTenantAdmin = (role: Role): boolean => role === Role.TENANT_ADMIN;
export const isManager = (role: Role): boolean => role === Role.MANAGER;
export const isMember = (role: Role): boolean => role === Role.MEMBER;

export const TENANT_SCOPED_ROLES: Role[] = [Role.TENANT_ADMIN, Role.MANAGER, Role.MEMBER];

export const requiresTenant = (role: Role): boolean => TENANT_SCOPED_ROLES.includes(role);
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Prisma schema for Tenant, User, Gym with roles"
```

---

## Task 4: Prisma client singleton

**Files:**
- Create: `src/lib/prisma.ts`

- [ ] **Step 1: Create singleton**

Create `src/lib/prisma.ts`:
```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/prisma.ts
git commit -m "feat: add Prisma client singleton"
```

---

## Task 5: Password hashing utility (TDD)

**Files:**
- Create: `src/lib/password.ts`, `tests/lib/password.test.ts`, `vitest.config.ts`

- [ ] **Step 1: Configure Vitest**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: [],
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

Add scripts to `package.json` (merge into existing `"scripts"` block):
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "test": "dotenv -e .env.local -- vitest run",
  "test:watch": "dotenv -e .env.local -- vitest",
  "typecheck": "tsc --noEmit",
  "db:migrate": "dotenv -e .env.local -- prisma migrate dev",
  "db:seed": "dotenv -e .env.local -- tsx prisma/seed.ts",
  "db:reset": "dotenv -e .env.local -- prisma migrate reset"
}
```

- [ ] **Step 2: Write failing test**

Create `tests/lib/password.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password", () => {
  it("hashes a password to a non-empty string different from input", async () => {
    const hash = await hashPassword("hunter2");
    expect(hash).toBeTypeOf("string");
    expect(hash.length).toBeGreaterThan(20);
    expect(hash).not.toBe("hunter2");
  });

  it("verifies a correct password", async () => {
    const hash = await hashPassword("hunter2");
    expect(await verifyPassword("hunter2", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("hunter2");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});
```

- [ ] **Step 3: Run test, verify failure**

```bash
npm test -- tests/lib/password.test.ts
```
Expected: FAIL, "Cannot find module '@/lib/password'".

- [ ] **Step 4: Implement**

Create `src/lib/password.ts`:
```typescript
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 5: Run test, verify pass**

```bash
npm test -- tests/lib/password.test.ts
```
Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add bcrypt password hashing utility with tests"
```

---

## Task 6: NextAuth configuration

**Files:**
- Create: `src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/types/next-auth.d.ts`

- [ ] **Step 1: Define NextAuth config**

Create `src/lib/auth.ts`:
```typescript
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { Role, UserStatus } from "@prisma/client";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        });
        if (!user) return null;
        if (user.status !== UserStatus.ACTIVE) return null;

        const ok = await verifyPassword(credentials.password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          gymId: user.gymId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.gymId = user.gymId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.tenantId = token.tenantId as string | null;
        session.user.gymId = token.gymId as string | null;
      }
      return session;
    },
  },
};
```

- [ ] **Step 2: Create NextAuth route handler**

Create `src/app/api/auth/[...nextauth]/route.ts`:
```typescript
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
```

- [ ] **Step 3: Extend NextAuth types**

Create `src/types/next-auth.d.ts`:
```typescript
import { Role } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      tenantId: string | null;
      gymId: string | null;
    };
  }

  interface User {
    id: string;
    role: Role;
    tenantId: string | null;
    gymId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    tenantId: string | null;
    gymId: string | null;
  }
}
```

- [ ] **Step 4: Verify typecheck passes**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: configure NextAuth with credentials provider + typed session"
```

---

## Task 7: Auth context helper (TDD)

**Files:**
- Create: `src/lib/auth-context.ts`, `tests/lib/auth-context.test.ts`, `tests/helpers/db.ts`

- [ ] **Step 1: Create test DB helper**

Create `tests/helpers/db.ts`:
```typescript
import { PrismaClient } from "@prisma/client";

const testUrl = process.env.DATABASE_URL_TEST;
if (!testUrl) throw new Error("DATABASE_URL_TEST not set");

export const testPrisma = new PrismaClient({ datasources: { db: { url: testUrl } } });

export async function resetDb(): Promise<void> {
  await testPrisma.user.deleteMany();
  await testPrisma.gym.deleteMany();
  await testPrisma.tenant.deleteMany();
}
```

- [ ] **Step 2: Write failing test**

Create `tests/lib/auth-context.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, resetDb } from "../helpers/db";
import { buildAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";

describe("buildAuthContext", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("returns null when session is null", () => {
    expect(buildAuthContext(null)).toBeNull();
  });

  it("builds context for PLATFORM_OWNER with null tenantId", () => {
    const ctx = buildAuthContext({
      user: { id: "u1", email: "po@x.com", name: "PO", role: Role.PLATFORM_OWNER, tenantId: null, gymId: null },
      expires: "2099-01-01",
    });
    expect(ctx).toEqual({
      userId: "u1",
      role: Role.PLATFORM_OWNER,
      tenantId: null,
      gymId: null,
    });
  });

  it("builds context for MANAGER with tenantId and gymId", () => {
    const ctx = buildAuthContext({
      user: { id: "u2", email: "m@x.com", name: "M", role: Role.MANAGER, tenantId: "t1", gymId: "g1" },
      expires: "2099-01-01",
    });
    expect(ctx?.tenantId).toBe("t1");
    expect(ctx?.gymId).toBe("g1");
  });
});
```

- [ ] **Step 3: Run test, verify failure**

```bash
npm test -- tests/lib/auth-context.test.ts
```
Expected: FAIL, "Cannot find module '@/lib/auth-context'".

- [ ] **Step 4: Implement**

Create `src/lib/auth-context.ts`:
```typescript
import { Session } from "next-auth";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Role } from "@prisma/client";

export interface AuthContext {
  userId: string;
  role: Role;
  tenantId: string | null;
  gymId: string | null;
}

export function buildAuthContext(session: Session | null): AuthContext | null {
  if (!session?.user) return null;
  return {
    userId: session.user.id,
    role: session.user.role,
    tenantId: session.user.tenantId,
    gymId: session.user.gymId,
  };
}

export async function getCurrentAuthContext(): Promise<AuthContext | null> {
  const session = await getServerSession(authOptions);
  return buildAuthContext(session);
}
```

- [ ] **Step 5: Run test, verify pass**

```bash
npm test -- tests/lib/auth-context.test.ts
```
Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add auth context helper with tests"
```

---

## Task 8: Tenant-scoped Prisma client (TDD) — CRITICAL

**Files:**
- Create: `src/lib/prisma-tenant.ts`, `tests/lib/prisma-tenant.test.ts`

This is the linchpin of SaaS isolation. Every test here protects against data leak between tenants.

- [ ] **Step 1: Write failing tests for isolation**

Create `tests/lib/prisma-tenant.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, resetDb } from "../helpers/db";
import { tenantPrisma, platformPrisma } from "@/lib/prisma-tenant";
import { Role, TenantStatus, UserStatus } from "@prisma/client";

async function seedTwoTenants() {
  const tA = await testPrisma.tenant.create({
    data: { name: "TenantA", slug: "tenant-a", ownerEmail: "a@x.com", ownerPhone: "1", city: "Dakar", status: TenantStatus.ACTIVE },
  });
  const tB = await testPrisma.tenant.create({
    data: { name: "TenantB", slug: "tenant-b", ownerEmail: "b@x.com", ownerPhone: "2", city: "Dakar", status: TenantStatus.ACTIVE },
  });
  const gA = await testPrisma.gym.create({
    data: { tenantId: tA.id, name: "GymA1", address: "addr", city: "Dakar", phone: "1", latitude: 14.7, longitude: -17.4 },
  });
  const gB = await testPrisma.gym.create({
    data: { tenantId: tB.id, name: "GymB1", address: "addr", city: "Dakar", phone: "2", latitude: 14.7, longitude: -17.4 },
  });
  return { tA, tB, gA, gB };
}

describe("tenantPrisma isolation", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("findMany on Gym only returns rows for the scoped tenant", async () => {
    const { tA } = await seedTwoTenants();
    const client = tenantPrisma(testPrisma, tA.id);
    const gyms = await client.gym.findMany();
    expect(gyms).toHaveLength(1);
    expect(gyms[0].tenantId).toBe(tA.id);
  });

  it("findUnique on Gym returns null when the row belongs to a different tenant", async () => {
    const { tA, gB } = await seedTwoTenants();
    const client = tenantPrisma(testPrisma, tA.id);
    const gym = await client.gym.findUnique({ where: { id: gB.id } });
    expect(gym).toBeNull();
  });

  it("create on Gym forces the scoped tenantId even if caller passes another", async () => {
    const { tA, tB } = await seedTwoTenants();
    const client = tenantPrisma(testPrisma, tA.id);
    const gym = await client.gym.create({
      data: { tenantId: tB.id, name: "Hack", address: "x", city: "x", phone: "1", latitude: 0, longitude: 0 },
    });
    expect(gym.tenantId).toBe(tA.id);
  });

  it("update on Gym refuses to touch rows from another tenant", async () => {
    const { tA, gB } = await seedTwoTenants();
    const client = tenantPrisma(testPrisma, tA.id);
    await expect(
      client.gym.update({ where: { id: gB.id }, data: { name: "Pwned" } })
    ).rejects.toThrow();
  });

  it("delete on Gym refuses to delete rows from another tenant", async () => {
    const { tA, gB } = await seedTwoTenants();
    const client = tenantPrisma(testPrisma, tA.id);
    await expect(client.gym.delete({ where: { id: gB.id } })).rejects.toThrow();
    const stillThere = await testPrisma.gym.findUnique({ where: { id: gB.id } });
    expect(stillThere).not.toBeNull();
  });

  it("count on User only counts users of the scoped tenant", async () => {
    const { tA, tB } = await seedTwoTenants();
    await testPrisma.user.createMany({
      data: [
        { name: "A1", email: "a1@x.com", passwordHash: "x", role: Role.MEMBER, status: UserStatus.ACTIVE, tenantId: tA.id },
        { name: "A2", email: "a2@x.com", passwordHash: "x", role: Role.MEMBER, status: UserStatus.ACTIVE, tenantId: tA.id },
        { name: "B1", email: "b1@x.com", passwordHash: "x", role: Role.MEMBER, status: UserStatus.ACTIVE, tenantId: tB.id },
      ],
    });
    const client = tenantPrisma(testPrisma, tA.id);
    expect(await client.user.count()).toBe(2);
  });
});

describe("platformPrisma bypass", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("sees every tenant's rows (no scoping)", async () => {
    await seedTwoTenants();
    const client = platformPrisma(testPrisma);
    const gyms = await client.gym.findMany();
    expect(gyms).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests, verify failure**

```bash
npm test -- tests/lib/prisma-tenant.test.ts
```
Expected: FAIL, "Cannot find module '@/lib/prisma-tenant'".

- [ ] **Step 3: Implement tenant-scoped client**

Create `src/lib/prisma-tenant.ts`:
```typescript
import { PrismaClient, Prisma } from "@prisma/client";

const TENANT_SCOPED_MODELS = new Set(["Gym", "User"]);

export function tenantPrisma(base: PrismaClient, tenantId: string) {
  return base.$extends({
    name: "tenantScope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_SCOPED_MODELS.has(model)) {
            return query(args);
          }

          const a = args as Record<string, any>;

          switch (operation) {
            case "findUnique":
            case "findUniqueOrThrow":
            case "findFirst":
            case "findFirstOrThrow":
            case "findMany":
            case "count":
            case "aggregate":
            case "groupBy": {
              a.where = { ...(a.where ?? {}), tenantId };
              break;
            }
            case "update":
            case "updateMany":
            case "delete":
            case "deleteMany": {
              a.where = { ...(a.where ?? {}), tenantId };
              break;
            }
            case "create": {
              a.data = { ...(a.data ?? {}), tenantId };
              break;
            }
            case "createMany": {
              if (Array.isArray(a.data)) {
                a.data = a.data.map((row: Record<string, any>) => ({ ...row, tenantId }));
              } else {
                a.data = { ...a.data, tenantId };
              }
              break;
            }
            case "upsert": {
              a.where = { ...(a.where ?? {}), tenantId };
              a.create = { ...(a.create ?? {}), tenantId };
              break;
            }
            default:
              break;
          }

          return query(a);
        },
      },
    },
  });
}

export function platformPrisma(base: PrismaClient) {
  return base;
}

export type TenantPrismaClient = ReturnType<typeof tenantPrisma>;
```

- [ ] **Step 4: Run tests, verify pass**

```bash
npm test -- tests/lib/prisma-tenant.test.ts
```
Expected: all 7 tests PASS.

If "update refuses other tenant" or "delete refuses other tenant" test fails because Prisma silently no-ops instead of throwing on `findUnique`-based update of a missing row, that's expected — the test asserts `.rejects.toThrow()`. In Prisma, `update`/`delete` with `where` matching zero rows throws `P2025`. Verify the thrown error code is `P2025`. If Prisma returns null silently instead, change the assertion to:
```typescript
await expect(...).rejects.toMatchObject({ code: "P2025" });
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add tenant-scoped Prisma client with isolation tests"
```

---

## Task 9: Next.js middleware (route protection by role)

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Write middleware**

Create `src/middleware.ts`:
```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { Role } from "@prisma/client";

const PUBLIC_PATHS = ["/", "/login", "/signup", "/checkin"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

const ROUTE_ROLES: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: "/platform", roles: [Role.PLATFORM_OWNER] },
  { prefix: "/admin", roles: [Role.TENANT_ADMIN] },
  { prefix: "/manager", roles: [Role.MANAGER] },
  { prefix: "/me", roles: [Role.MEMBER] },
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/favicon") ||
    isPublic(pathname)
  ) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  const match = ROUTE_ROLES.find((r) => pathname.startsWith(r.prefix));
  if (match && !match.roles.includes(token.role as Role)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "forbidden");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: protect routes by role via Next.js middleware"
```

---

## Task 10: Landing + Login pages

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/app/login/page.tsx`, `src/app/login/login-form.tsx`

- [ ] **Step 1: Replace default landing**

Replace `src/app/page.tsx` with:
```tsx
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight">Gym Management SaaS</h1>
        <p className="text-lg text-slate-400">
          Plateforme moderne de gestion de salles de sport. Check-in QR, paiements, multi-salles.
        </p>
        <div className="flex gap-4 justify-center pt-4">
          <Link
            href="/login"
            className="px-6 py-3 rounded-md bg-blue-600 hover:bg-blue-500 font-medium transition"
          >
            Connexion
          </Link>
          <Link
            href="/signup"
            className="px-6 py-3 rounded-md border border-slate-700 hover:bg-slate-800 font-medium transition"
          >
            Inscrire ma salle
          </Link>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Create login form (client component)**

Create `src/app/login/login-form.tsx`:
```tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/";
  const initialError = params.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false, callbackUrl });
    setLoading(false);
    if (res?.error) {
      setError("Identifiants invalides");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm mb-1 text-slate-300">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100"
        />
      </div>
      <div>
        <label className="block text-sm mb-1 text-slate-300">Mot de passe</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100"
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-medium"
      >
        {loading ? "Connexion..." : "Se connecter"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Create login page (server component)**

Create `src/app/login/page.tsx`:
```tsx
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-semibold text-center">Connexion</h1>
        <LoginForm />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Wrap app with NextAuth SessionProvider**

Replace `src/app/layout.tsx` with:
```tsx
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Gym Management SaaS",
  description: "Plateforme moderne de gestion de salles de sport",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

Create `src/app/providers.tsx`:
```tsx
"use client";

import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

- [ ] **Step 5: Verify build and run**

```bash
npm run build
```
Expected: build succeeds, no type errors.

```bash
npm run dev
```
Open http://localhost:3000 — landing renders. Click "Connexion" — login form renders. Kill server.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add landing page and login form"
```

---

## Task 11: Seed PLATFORM_OWNER

**Files:**
- Create: `prisma/seed.ts`

- [ ] **Step 1: Write seed script**

Create `prisma/seed.ts`:
```typescript
import { PrismaClient, Role, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "owner@platform.local";
  const password = "ChangeMe123!";
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`PLATFORM_OWNER already exists: ${email}`);
    return;
  }

  await prisma.user.create({
    data: {
      name: "Platform Owner",
      email,
      passwordHash,
      role: Role.PLATFORM_OWNER,
      status: UserStatus.ACTIVE,
    },
  });

  console.log(`Created PLATFORM_OWNER:`);
  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}`);
  console.log(`Change the password after first login.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run seed**

```bash
npm run db:seed
```
Expected: "Created PLATFORM_OWNER" with credentials printed.

- [ ] **Step 3: Verify in DB**

```bash
psql gym_management -c "SELECT email, role, status FROM \"User\";"
```
Expected: one row with `owner@platform.local | PLATFORM_OWNER | ACTIVE`.

- [ ] **Step 4: Manual smoke test of login**

```bash
npm run dev
```
Open http://localhost:3000/login, log in with `owner@platform.local` / `ChangeMe123!`. After submit, you are redirected to `/`. Open browser devtools → Application → Cookies — `next-auth.session-token` exists. Then visit `/platform` — should NOT redirect to login (because role is PLATFORM_OWNER and `/platform` requires that role). Visit `/admin` — should redirect to `/login?error=forbidden`.

Kill server.

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: seed PLATFORM_OWNER user"
```

---

## Task 12: README run-book

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

Create `README.md`:
```markdown
# Gym Management SaaS

Multi-tenant SaaS for gym chain management. Next.js 14 + PostgreSQL + Prisma + NextAuth.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create databases:
   ```bash
   createdb gym_management
   createdb gym_management_test
   ```

3. Configure env:
   ```bash
   cp .env.example .env.local
   # Edit .env.local — generate NEXTAUTH_SECRET with: openssl rand -base64 32
   ```

4. Run migrations:
   ```bash
   npm run db:migrate
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/gym_management_test?schema=public" npx prisma migrate deploy
   ```

5. Seed PLATFORM_OWNER:
   ```bash
   npm run db:seed
   ```

6. Run dev server:
   ```bash
   npm run dev
   ```

## Default credentials

After seeding:
- Email: `owner@platform.local`
- Password: `ChangeMe123!`

Change the password after first login.

## Commands

- `npm run dev` — dev server
- `npm run build` — production build
- `npm test` — run tests
- `npm run typecheck` — type-check
- `npm run db:migrate` — create/apply migration
- `npm run db:seed` — seed PLATFORM_OWNER
- `npm run db:reset` — drop + recreate dev DB

## Architecture

See `docs/superpowers/specs/2026-05-24-gym-management-design.md`.

## Roles

- `PLATFORM_OWNER` — manages tenants, no tenant scope
- `TENANT_ADMIN` — manages one organization's gyms
- `MANAGER` — manages one gym
- `MEMBER` — gym member

## Tenant isolation

All queries from non-PLATFORM_OWNER contexts go through `tenantPrisma(prisma, tenantId)` in `src/lib/prisma-tenant.ts`. Never use the raw `prisma` import for tenant-scoped data.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup instructions"
```

---

## Task 13: Full verification

- [ ] **Step 1: Reset DB and run full flow**

```bash
npm run db:reset
# Type "y" to confirm. Migration + Prisma Client regenerate.
npm run db:seed
```

- [ ] **Step 2: Run all tests**

```bash
npm test
```
Expected: all tests PASS (password: 3, auth-context: 3, prisma-tenant: 7).

- [ ] **Step 3: Type-check**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 4: Production build**

```bash
npm run build
```
Expected: build succeeds.

- [ ] **Step 5: Final commit**

```bash
git add -A
git status
# If nothing to commit, skip. If there are changes (e.g., regenerated lockfile), commit them:
git commit -m "chore: foundation milestone — multi-tenant core ready"
```

---

## Done criteria

- [ ] All 13 tests pass (`npm test`)
- [ ] `npm run build` succeeds
- [ ] `npm run typecheck` passes
- [ ] Login as PLATFORM_OWNER works via UI
- [ ] `/platform` accessible to PLATFORM_OWNER, `/admin` blocked for them
- [ ] Tenant isolation tests prove no cross-tenant data leak

## What's next (Plan 2)

Onboarding tenant + PLATFORM_OWNER dashboard:
- `/signup` form
- Tenant validation queue in `/platform/tenants`
- Email activation flow (Resend)
- Wizard "première salle" for newly activated TENANT_ADMIN
