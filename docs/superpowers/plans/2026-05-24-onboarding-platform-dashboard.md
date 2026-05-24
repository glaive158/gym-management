# Onboarding Tenant + PLATFORM_OWNER Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full onboarding flow — public signup creates `PENDING` tenant, PLATFORM_OWNER validates from dashboard, email activation sets password, TENANT_ADMIN lands in a wizard to create the first gym.

**Architecture:** Server Actions for mutations, server components for data fetching. Activation tokens stored on `User` row, sent via Resend (falls back to console log in dev when no API key). PLATFORM_OWNER dashboard uses `platformPrisma` (no tenant scope). TENANT_ADMIN dashboard uses `tenantPrisma` scoped to their tenant.

**Tech Stack:** Next.js 14 Server Actions, Prisma, Zod (input validation), Resend (email), shadcn/ui primitives (inline since shadcn not installed yet — minimal Tailwind components).

**Prerequisite:** Plan 1 merged to main. Repo on branch `feat/onboarding-platform-dashboard`. Dev DB seeded with PLATFORM_OWNER.

---

## File Structure

```
gym-management/
├── prisma/
│   └── schema.prisma                            # extend User with activation fields
├── src/
│   ├── app/
│   │   ├── signup/
│   │   │   ├── page.tsx                         # public form
│   │   │   └── signup-form.tsx                  # client component
│   │   ├── activate/
│   │   │   ├── page.tsx                         # set-password via token
│   │   │   └── activate-form.tsx                # client component
│   │   ├── platform/
│   │   │   ├── layout.tsx                       # nav shell
│   │   │   ├── page.tsx                         # dashboard home (stats)
│   │   │   └── tenants/
│   │   │       ├── page.tsx                     # tenants list
│   │   │       └── [id]/
│   │   │           └── page.tsx                 # tenant detail + actions
│   │   ├── admin/
│   │   │   ├── layout.tsx                       # nav shell for TENANT_ADMIN
│   │   │   ├── page.tsx                         # dashboard home
│   │   │   └── onboarding/
│   │   │       └── page.tsx                     # first-gym wizard
│   │   └── api/
│   │       └── signup/
│   │           └── route.ts                     # POST signup
│   ├── lib/
│   │   ├── email.ts                             # Resend wrapper + dev fallback
│   │   ├── activation-token.ts                  # generate/verify token
│   │   ├── slug.ts                              # slugify org name
│   │   └── server-actions/
│   │       ├── tenant-validation.ts             # validateTenant, rejectTenant, suspendTenant
│   │       ├── tenant-signup.ts                 # createSignupRequest
│   │       ├── activate-account.ts              # activateWithToken
│   │       └── create-first-gym.ts              # createFirstGym
│   └── components/
│       ├── ui/
│       │   ├── button.tsx                       # minimal Tailwind button
│       │   ├── input.tsx
│       │   ├── label.tsx
│       │   ├── card.tsx
│       │   └── badge.tsx
│       └── platform/
│           └── tenant-row-actions.tsx           # validate/reject buttons
└── tests/
    ├── lib/
    │   ├── slug.test.ts
    │   ├── activation-token.test.ts
    │   └── server-actions/
    │       ├── tenant-signup.test.ts
    │       ├── tenant-validation.test.ts
    │       ├── activate-account.test.ts
    │       └── create-first-gym.test.ts
```

---

## Task 1: Extend User schema with activation fields

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add activation fields**

In `prisma/schema.prisma`, modify the `User` model. Find the existing field list and add these three fields right after `gymId`:

```prisma
  activationToken        String?    @unique
  activationTokenExpiresAt DateTime?
  passwordSetAt          DateTime?
```

The full updated User model should look like:
```prisma
model User {
  id                       String     @id @default(cuid())
  name                     String
  email                    String     @unique
  phone                    String?
  passwordHash             String
  avatar                   String?
  role                     Role
  status                   UserStatus @default(ACTIVE)
  tenantId                 String?
  gymId                    String?
  activationToken          String?    @unique
  activationTokenExpiresAt DateTime?
  passwordSetAt            DateTime?
  createdAt                DateTime   @default(now())
  updatedAt                DateTime   @updatedAt

  tenant                   Tenant?    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  gym                      Gym?       @relation(fields: [gymId], references: [id], onDelete: SetNull)
  validatedTenants         Tenant[]   @relation("TenantValidator")

  @@index([tenantId])
  @@index([gymId])
  @@index([role])
  @@index([activationToken])
}
```

Also make `passwordHash` optional since signup creates a User without a password (set later via activation):
Change `passwordHash             String` to `passwordHash             String?`

And update `src/lib/auth.ts` to handle null passwordHash — see Task 2 step 4.

- [ ] **Step 2: Migrate dev DB**

```bash
cd /Users/admin/gym-management
npm run db:migrate -- --name add_user_activation_fields
```
Expected: migration created, applied.

- [ ] **Step 3: Migrate test DB**

```bash
DATABASE_URL="postgresql://admin@localhost:5432/gym_management_test?schema=public" npx prisma migrate deploy
```
Expected: migration applied to test DB.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(db): add activation token fields on User"
```

---

## Task 2: Slugify helper (TDD)

**Files:**
- Create: `src/lib/slug.ts`, `tests/lib/slug.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/lib/slug.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { slugify, uniqueSlug } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases and replaces spaces", () => {
    expect(slugify("FitClub Dakar")).toBe("fitclub-dakar");
  });
  it("removes accents", () => {
    expect(slugify("Sénégal Élite")).toBe("senegal-elite");
  });
  it("strips non-alphanumeric punctuation", () => {
    expect(slugify("Power & Muscle, Inc.")).toBe("power-muscle-inc");
  });
  it("collapses repeated dashes", () => {
    expect(slugify("Hello   World!!!")).toBe("hello-world");
  });
  it("trims leading and trailing dashes", () => {
    expect(slugify("---hello---")).toBe("hello");
  });
});

describe("uniqueSlug", () => {
  it("returns base slug when not taken", async () => {
    const result = await uniqueSlug("fitclub", async () => false);
    expect(result).toBe("fitclub");
  });
  it("appends -2 when base taken once", async () => {
    let calls = 0;
    const exists = async (s: string) => {
      calls++;
      return s === "fitclub";
    };
    const result = await uniqueSlug("fitclub", exists);
    expect(result).toBe("fitclub-2");
    expect(calls).toBe(2);
  });
  it("keeps incrementing until free", async () => {
    const taken = new Set(["fitclub", "fitclub-2", "fitclub-3"]);
    const result = await uniqueSlug("fitclub", async (s) => taken.has(s));
    expect(result).toBe("fitclub-4");
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
npm test -- tests/lib/slug.test.ts
```
Expected: FAIL, "Cannot find module '@/lib/slug'".

- [ ] **Step 3: Implement**

Create `src/lib/slug.ts`:
```typescript
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>
): Promise<string> {
  let candidate = base;
  let n = 1;
  while (await exists(candidate)) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
}
```

- [ ] **Step 4: Run test, verify pass**

```bash
npm test -- tests/lib/slug.test.ts
```
Expected: 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add slugify and uniqueSlug helpers"
```

---

## Task 3: Activation token helper (TDD)

**Files:**
- Create: `src/lib/activation-token.ts`, `tests/lib/activation-token.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/lib/activation-token.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { generateActivationToken, isTokenExpired } from "@/lib/activation-token";

describe("generateActivationToken", () => {
  it("returns a token + expiration roughly 7 days in the future", () => {
    const before = Date.now();
    const { token, expiresAt } = generateActivationToken();
    expect(token).toBeTypeOf("string");
    expect(token.length).toBeGreaterThanOrEqual(32);
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const delta = expiresAt.getTime() - before;
    expect(delta).toBeGreaterThan(sevenDays - 5000);
    expect(delta).toBeLessThan(sevenDays + 5000);
  });

  it("returns different tokens on subsequent calls", () => {
    const a = generateActivationToken();
    const b = generateActivationToken();
    expect(a.token).not.toBe(b.token);
  });
});

describe("isTokenExpired", () => {
  it("returns false when expiration is in the future", () => {
    const future = new Date(Date.now() + 60_000);
    expect(isTokenExpired(future)).toBe(false);
  });
  it("returns true when expiration is in the past", () => {
    const past = new Date(Date.now() - 60_000);
    expect(isTokenExpired(past)).toBe(true);
  });
  it("returns true when expiresAt is null", () => {
    expect(isTokenExpired(null)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
npm test -- tests/lib/activation-token.test.ts
```
Expected: FAIL, "Cannot find module".

- [ ] **Step 3: Implement**

Create `src/lib/activation-token.ts`:
```typescript
import crypto from "node:crypto";

const TOKEN_BYTES = 32;
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface ActivationToken {
  token: string;
  expiresAt: Date;
}

export function generateActivationToken(): ActivationToken {
  const token = crypto.randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  return { token, expiresAt };
}

export function isTokenExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() <= Date.now();
}
```

- [ ] **Step 4: Run test, verify pass**

```bash
npm test -- tests/lib/activation-token.test.ts
```
Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add activation token generator + expiry check"
```

---

## Task 4: Email wrapper (Resend + dev fallback)

**Files:**
- Modify: `package.json` (add `resend`)
- Modify: `.env.example`, `.env.local` (add RESEND_API_KEY, EMAIL_FROM, APP_URL)
- Create: `src/lib/email.ts`

- [ ] **Step 1: Install resend**

```bash
cd /Users/admin/gym-management
npm install resend
```

- [ ] **Step 2: Extend env files**

Append to `.env.example`:
```
RESEND_API_KEY=""
EMAIL_FROM="Gym SaaS <onboarding@example.com>"
APP_URL="http://localhost:3000"
```

Append to `.env.local`:
```
RESEND_API_KEY=""
EMAIL_FROM="Gym SaaS <onboarding@example.com>"
APP_URL="http://localhost:3000"
```

Empty `RESEND_API_KEY` triggers the dev console fallback — see implementation below.

- [ ] **Step 3: Implement email module**

Create `src/lib/email.ts`:
```typescript
import { Resend } from "resend";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Gym SaaS <onboarding@example.com>";

  if (!apiKey) {
    // Dev fallback — log to server console
    console.log("\n📧 EMAIL (dev fallback, RESEND_API_KEY not set):");
    console.log(`  From:    ${from}`);
    console.log(`  To:      ${input.to}`);
    console.log(`  Subject: ${input.subject}`);
    console.log(`  Text:\n${input.text}\n`);
    return;
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}

export function buildActivationEmail(params: {
  recipientName: string;
  activationUrl: string;
}): { subject: string; html: string; text: string } {
  const { recipientName, activationUrl } = params;
  const subject = "Activez votre compte Gym SaaS";
  const text = `Bonjour ${recipientName},

Votre organisation a été validée. Pour finaliser votre compte, définissez votre mot de passe en cliquant sur le lien ci-dessous :

${activationUrl}

Ce lien expire dans 7 jours.

Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.`;
  const html = `<p>Bonjour ${recipientName},</p>
<p>Votre organisation a été validée. Pour finaliser votre compte, définissez votre mot de passe :</p>
<p><a href="${activationUrl}">Activer mon compte</a></p>
<p>Ce lien expire dans 7 jours.</p>
<p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>`;
  return { subject, html, text };
}

export function buildRejectionEmail(params: {
  recipientName: string;
  organizationName: string;
  reason: string;
}): { subject: string; html: string; text: string } {
  const subject = "Votre demande Gym SaaS a été refusée";
  const text = `Bonjour ${params.recipientName},

Votre demande d'inscription pour "${params.organizationName}" a été refusée.

Raison : ${params.reason}

Vous pouvez nous contacter pour plus d'informations.`;
  const html = `<p>Bonjour ${params.recipientName},</p>
<p>Votre demande d'inscription pour <strong>${params.organizationName}</strong> a été refusée.</p>
<p>Raison : ${params.reason}</p>`;
  return { subject, html, text };
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add Resend email wrapper with dev console fallback"
```

---

## Task 5: Update NextAuth for nullable passwordHash

**Files:**
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: Reject login when passwordHash is null**

In `src/lib/auth.ts`, find the `authorize` function. After the `if (user.status !== UserStatus.ACTIVE) return null;` line, add:
```typescript
        if (!user.passwordHash) return null;
```

The full updated `authorize` function:
```typescript
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        });
        if (!user) return null;
        if (user.status !== UserStatus.ACTIVE) return null;
        if (!user.passwordHash) return null;

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
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth.ts
git commit -m "fix(auth): reject login when passwordHash is null"
```

---

## Task 6: Signup server action (TDD)

**Files:**
- Create: `src/lib/server-actions/tenant-signup.ts`, `tests/lib/server-actions/tenant-signup.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/lib/server-actions/tenant-signup.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, resetDb } from "../../helpers/db";
import { createSignupRequest } from "@/lib/server-actions/tenant-signup";
import { Role, TenantStatus, UserStatus } from "@prisma/client";

describe("createSignupRequest", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  function input(overrides: Partial<Parameters<typeof createSignupRequest>[0]> = {}) {
    return {
      organizationName: "FitClub Dakar",
      ownerName: "Aliou Diop",
      ownerEmail: "aliou@fitclub.sn",
      ownerPhone: "+221771234567",
      city: "Dakar",
      prisma: testPrisma,
      ...overrides,
    };
  }

  it("creates a Tenant in PENDING status", async () => {
    const result = await createSignupRequest(input());
    expect(result.success).toBe(true);
    const tenants = await testPrisma.tenant.findMany();
    expect(tenants).toHaveLength(1);
    expect(tenants[0].status).toBe(TenantStatus.PENDING);
    expect(tenants[0].name).toBe("FitClub Dakar");
    expect(tenants[0].slug).toBe("fitclub-dakar");
  });

  it("creates a User TENANT_ADMIN in PENDING status with no password", async () => {
    await createSignupRequest(input());
    const users = await testPrisma.user.findMany();
    expect(users).toHaveLength(1);
    expect(users[0].role).toBe(Role.TENANT_ADMIN);
    expect(users[0].status).toBe(UserStatus.PENDING);
    expect(users[0].passwordHash).toBeNull();
    expect(users[0].email).toBe("aliou@fitclub.sn");
  });

  it("rejects duplicate email", async () => {
    await createSignupRequest(input());
    const result = await createSignupRequest(input({ organizationName: "Other Org" }));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/email.*déjà|already/i);
  });

  it("appends -2 when slug collides", async () => {
    await createSignupRequest(input());
    await createSignupRequest(input({ ownerEmail: "second@fitclub.sn" }));
    const tenants = await testPrisma.tenant.findMany({ orderBy: { createdAt: "asc" } });
    expect(tenants[0].slug).toBe("fitclub-dakar");
    expect(tenants[1].slug).toBe("fitclub-dakar-2");
  });

  it("rejects invalid email", async () => {
    const result = await createSignupRequest(input({ ownerEmail: "not-an-email" }));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/email/i);
  });

  it("rejects missing required fields", async () => {
    const result = await createSignupRequest(input({ organizationName: "" }));
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
npm test -- tests/lib/server-actions/tenant-signup.test.ts
```
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

Create `src/lib/server-actions/tenant-signup.ts`:
```typescript
import { z } from "zod";
import { PrismaClient, Role, TenantStatus, UserStatus } from "@prisma/client";
import { slugify, uniqueSlug } from "@/lib/slug";

const SignupSchema = z.object({
  organizationName: z.string().min(1, "Nom de l'organisation requis"),
  ownerName: z.string().min(1, "Nom du propriétaire requis"),
  ownerEmail: z.string().email("Email invalide"),
  ownerPhone: z.string().min(5, "Téléphone requis"),
  city: z.string().min(1, "Ville requise"),
});

export interface CreateSignupResult {
  success: boolean;
  tenantId?: string;
  error?: string;
}

export async function createSignupRequest(input: {
  organizationName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  city: string;
  prisma: PrismaClient;
}): Promise<CreateSignupResult> {
  const parsed = SignupSchema.safeParse({
    organizationName: input.organizationName,
    ownerName: input.ownerName,
    ownerEmail: input.ownerEmail,
    ownerPhone: input.ownerPhone,
    city: input.city,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const email = parsed.data.ownerEmail.toLowerCase();
  const existing = await input.prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { success: false, error: "Cet email est déjà utilisé" };
  }

  const baseSlug = slugify(parsed.data.organizationName) || "tenant";
  const slug = await uniqueSlug(baseSlug, async (s) => {
    const found = await input.prisma.tenant.findUnique({ where: { slug: s } });
    return !!found;
  });

  const tenant = await input.prisma.tenant.create({
    data: {
      name: parsed.data.organizationName,
      slug,
      ownerEmail: email,
      ownerPhone: parsed.data.ownerPhone,
      city: parsed.data.city,
      status: TenantStatus.PENDING,
    },
  });

  await input.prisma.user.create({
    data: {
      name: parsed.data.ownerName,
      email,
      phone: parsed.data.ownerPhone,
      passwordHash: null,
      role: Role.TENANT_ADMIN,
      status: UserStatus.PENDING,
      tenantId: tenant.id,
    },
  });

  return { success: true, tenantId: tenant.id };
}
```

- [ ] **Step 4: Run test, verify pass**

```bash
npm test -- tests/lib/server-actions/tenant-signup.test.ts
```
Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add createSignupRequest server action with tests"
```

---

## Task 7: Signup page + form

**Files:**
- Create: `src/app/signup/page.tsx`, `src/app/signup/signup-form.tsx`, `src/app/api/signup/route.ts`

- [ ] **Step 1: Create API route**

Create `src/app/api/signup/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSignupRequest } from "@/lib/server-actions/tenant-signup";

export async function POST(req: Request) {
  const body = await req.json();
  const result = await createSignupRequest({
    organizationName: body.organizationName,
    ownerName: body.ownerName,
    ownerEmail: body.ownerEmail,
    ownerPhone: body.ownerPhone,
    city: body.city,
    prisma,
  });
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, tenantId: result.tenantId });
}
```

- [ ] **Step 2: Create client form**

Create `src/app/signup/signup-form.tsx`:
```tsx
"use client";

import { useState } from "react";

export function SignupForm() {
  const [form, setForm] = useState({
    organizationName: "",
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    city: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Erreur inconnue");
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="text-center space-y-3">
        <h2 className="text-xl font-semibold text-green-400">Demande envoyée ✓</h2>
        <p className="text-slate-400 text-sm">
          Votre demande sera examinée par notre équipe. Vous recevrez un email d'activation
          dès validation.
        </p>
      </div>
    );
  }

  const inputCls = "w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100";
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="block text-sm mb-1 text-slate-300">Nom de l'organisation</label>
        <input className={inputCls} required value={form.organizationName} onChange={update("organizationName")} />
      </div>
      <div>
        <label className="block text-sm mb-1 text-slate-300">Votre nom</label>
        <input className={inputCls} required value={form.ownerName} onChange={update("ownerName")} />
      </div>
      <div>
        <label className="block text-sm mb-1 text-slate-300">Email</label>
        <input className={inputCls} type="email" required value={form.ownerEmail} onChange={update("ownerEmail")} />
      </div>
      <div>
        <label className="block text-sm mb-1 text-slate-300">Téléphone</label>
        <input className={inputCls} required value={form.ownerPhone} onChange={update("ownerPhone")} />
      </div>
      <div>
        <label className="block text-sm mb-1 text-slate-300">Ville</label>
        <input className={inputCls} required value={form.city} onChange={update("city")} />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-medium"
      >
        {loading ? "Envoi..." : "Envoyer ma demande"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Create page**

Create `src/app/signup/page.tsx`:
```tsx
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Inscrire ma salle</h1>
          <p className="text-sm text-slate-400 mt-1">
            Votre demande sera examinée avant activation.
          </p>
        </div>
        <SignupForm />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Manual smoke test**

```bash
npm run dev
```
Open http://localhost:3000/signup → fill form with `aliou@fitclub.sn` → submit. You should see "Demande envoyée ✓". Verify in DB:
```bash
psql gym_management -c "SELECT name, slug, status FROM \"Tenant\";"
psql gym_management -c "SELECT email, role, status FROM \"User\" WHERE role = 'TENANT_ADMIN';"
```
Expected: one PENDING tenant + one PENDING user. Kill server.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add public signup page + API route"
```

---

## Task 8: Tenant validation server action (TDD)

**Files:**
- Create: `src/lib/server-actions/tenant-validation.ts`, `tests/lib/server-actions/tenant-validation.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/lib/server-actions/tenant-validation.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, resetDb } from "../../helpers/db";
import { createSignupRequest } from "@/lib/server-actions/tenant-signup";
import {
  validateTenant,
  rejectTenant,
  suspendTenant,
} from "@/lib/server-actions/tenant-validation";
import { Role, TenantStatus, UserStatus } from "@prisma/client";

async function seedSignup() {
  await createSignupRequest({
    organizationName: "FitClub",
    ownerName: "Aliou",
    ownerEmail: "aliou@fitclub.sn",
    ownerPhone: "+221771234567",
    city: "Dakar",
    prisma: testPrisma,
  });
  const tenant = await testPrisma.tenant.findFirstOrThrow();
  const owner = await testPrisma.user.findFirstOrThrow({ where: { role: Role.TENANT_ADMIN } });
  return { tenant, owner };
}

async function seedPlatformOwner() {
  return testPrisma.user.create({
    data: {
      name: "PO",
      email: "po@platform.local",
      passwordHash: "hash",
      role: Role.PLATFORM_OWNER,
      status: UserStatus.ACTIVE,
    },
  });
}

describe("validateTenant", () => {
  beforeEach(async () => {
    await resetDb();
  });
  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("flips tenant to ACTIVE, sets validatedAt + validatedById", async () => {
    const po = await seedPlatformOwner();
    const { tenant } = await seedSignup();
    const result = await validateTenant({
      tenantId: tenant.id,
      platformOwnerId: po.id,
      prisma: testPrisma,
    });
    expect(result.success).toBe(true);
    const updated = await testPrisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
    expect(updated.status).toBe(TenantStatus.ACTIVE);
    expect(updated.validatedAt).not.toBeNull();
    expect(updated.validatedById).toBe(po.id);
    expect(updated.trialEndsAt).not.toBeNull();
  });

  it("generates activation token on the owner user", async () => {
    const po = await seedPlatformOwner();
    const { tenant, owner } = await seedSignup();
    await validateTenant({ tenantId: tenant.id, platformOwnerId: po.id, prisma: testPrisma });
    const updatedOwner = await testPrisma.user.findUniqueOrThrow({ where: { id: owner.id } });
    expect(updatedOwner.activationToken).not.toBeNull();
    expect(updatedOwner.activationTokenExpiresAt).not.toBeNull();
    expect(updatedOwner.status).toBe(UserStatus.PENDING); // still pending until they set password
  });

  it("returns activation URL in result", async () => {
    const po = await seedPlatformOwner();
    const { tenant } = await seedSignup();
    const result = await validateTenant({
      tenantId: tenant.id,
      platformOwnerId: po.id,
      prisma: testPrisma,
      appUrl: "https://app.example.com",
    });
    expect(result.activationUrl).toMatch(/^https:\/\/app\.example\.com\/activate\?token=/);
  });

  it("refuses to validate a non-PENDING tenant", async () => {
    const po = await seedPlatformOwner();
    const { tenant } = await seedSignup();
    await testPrisma.tenant.update({ where: { id: tenant.id }, data: { status: TenantStatus.ACTIVE } });
    const result = await validateTenant({
      tenantId: tenant.id,
      platformOwnerId: po.id,
      prisma: testPrisma,
    });
    expect(result.success).toBe(false);
  });
});

describe("rejectTenant", () => {
  beforeEach(async () => {
    await resetDb();
  });
  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("flips tenant to REJECTED with reason", async () => {
    const po = await seedPlatformOwner();
    const { tenant } = await seedSignup();
    const result = await rejectTenant({
      tenantId: tenant.id,
      platformOwnerId: po.id,
      reason: "Documents manquants",
      prisma: testPrisma,
    });
    expect(result.success).toBe(true);
    const updated = await testPrisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
    expect(updated.status).toBe(TenantStatus.REJECTED);
    expect(updated.rejectionReason).toBe("Documents manquants");
  });

  it("requires a non-empty reason", async () => {
    const po = await seedPlatformOwner();
    const { tenant } = await seedSignup();
    const result = await rejectTenant({
      tenantId: tenant.id,
      platformOwnerId: po.id,
      reason: "",
      prisma: testPrisma,
    });
    expect(result.success).toBe(false);
  });
});

describe("suspendTenant", () => {
  beforeEach(async () => {
    await resetDb();
  });
  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("flips ACTIVE tenant to SUSPENDED", async () => {
    const po = await seedPlatformOwner();
    const { tenant } = await seedSignup();
    await testPrisma.tenant.update({ where: { id: tenant.id }, data: { status: TenantStatus.ACTIVE } });
    const result = await suspendTenant({
      tenantId: tenant.id,
      platformOwnerId: po.id,
      prisma: testPrisma,
    });
    expect(result.success).toBe(true);
    const updated = await testPrisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
    expect(updated.status).toBe(TenantStatus.SUSPENDED);
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
npm test -- tests/lib/server-actions/tenant-validation.test.ts
```
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

Create `src/lib/server-actions/tenant-validation.ts`:
```typescript
import { PrismaClient, TenantStatus } from "@prisma/client";
import { generateActivationToken } from "@/lib/activation-token";

const TRIAL_DAYS = 14;

export interface ValidateTenantInput {
  tenantId: string;
  platformOwnerId: string;
  prisma: PrismaClient;
  appUrl?: string;
}

export interface ValidateTenantResult {
  success: boolean;
  activationUrl?: string;
  error?: string;
}

export async function validateTenant(input: ValidateTenantInput): Promise<ValidateTenantResult> {
  const tenant = await input.prisma.tenant.findUnique({ where: { id: input.tenantId } });
  if (!tenant) return { success: false, error: "Tenant introuvable" };
  if (tenant.status !== TenantStatus.PENDING) {
    return { success: false, error: "Ce tenant n'est pas en attente" };
  }

  const owner = await input.prisma.user.findFirst({
    where: { tenantId: tenant.id, role: "TENANT_ADMIN" },
  });
  if (!owner) return { success: false, error: "Propriétaire introuvable" };

  const { token, expiresAt: tokenExpires } = generateActivationToken();
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  await input.prisma.$transaction([
    input.prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        status: TenantStatus.ACTIVE,
        validatedAt: new Date(),
        validatedById: input.platformOwnerId,
        trialEndsAt,
      },
    }),
    input.prisma.user.update({
      where: { id: owner.id },
      data: {
        activationToken: token,
        activationTokenExpiresAt: tokenExpires,
      },
    }),
  ]);

  const appUrl = input.appUrl ?? process.env.APP_URL ?? "http://localhost:3000";
  const activationUrl = `${appUrl}/activate?token=${token}`;
  return { success: true, activationUrl };
}

export interface RejectTenantInput {
  tenantId: string;
  platformOwnerId: string;
  reason: string;
  prisma: PrismaClient;
}

export async function rejectTenant(input: RejectTenantInput): Promise<{ success: boolean; error?: string }> {
  if (!input.reason || input.reason.trim().length === 0) {
    return { success: false, error: "Raison du refus requise" };
  }
  const tenant = await input.prisma.tenant.findUnique({ where: { id: input.tenantId } });
  if (!tenant) return { success: false, error: "Tenant introuvable" };
  if (tenant.status !== TenantStatus.PENDING) {
    return { success: false, error: "Ce tenant n'est pas en attente" };
  }
  await input.prisma.tenant.update({
    where: { id: input.tenantId },
    data: {
      status: TenantStatus.REJECTED,
      rejectionReason: input.reason.trim(),
    },
  });
  return { success: true };
}

export interface SuspendTenantInput {
  tenantId: string;
  platformOwnerId: string;
  prisma: PrismaClient;
}

export async function suspendTenant(input: SuspendTenantInput): Promise<{ success: boolean; error?: string }> {
  const tenant = await input.prisma.tenant.findUnique({ where: { id: input.tenantId } });
  if (!tenant) return { success: false, error: "Tenant introuvable" };
  if (tenant.status !== TenantStatus.ACTIVE) {
    return { success: false, error: "Seul un tenant ACTIF peut être suspendu" };
  }
  await input.prisma.tenant.update({
    where: { id: input.tenantId },
    data: { status: TenantStatus.SUSPENDED },
  });
  return { success: true };
}
```

- [ ] **Step 4: Run test, verify pass**

```bash
npm test -- tests/lib/server-actions/tenant-validation.test.ts
```
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add tenant validation server actions with tests"
```

---

## Task 9: Activate account server action (TDD)

**Files:**
- Create: `src/lib/server-actions/activate-account.ts`, `tests/lib/server-actions/activate-account.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/lib/server-actions/activate-account.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, resetDb } from "../../helpers/db";
import { activateAccount } from "@/lib/server-actions/activate-account";
import { Role, UserStatus } from "@prisma/client";

async function seedPendingUserWithToken(token: string, expiresAt: Date) {
  return testPrisma.user.create({
    data: {
      name: "Aliou",
      email: "aliou@x.com",
      passwordHash: null,
      role: Role.TENANT_ADMIN,
      status: UserStatus.PENDING,
      activationToken: token,
      activationTokenExpiresAt: expiresAt,
    },
  });
}

describe("activateAccount", () => {
  beforeEach(async () => {
    await resetDb();
  });
  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("sets password, flips status to ACTIVE, clears token", async () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await seedPendingUserWithToken("validtoken123", future);

    const result = await activateAccount({
      token: "validtoken123",
      password: "Hunter2Pass!",
      prisma: testPrisma,
    });
    expect(result.success).toBe(true);

    const updated = await testPrisma.user.findUniqueOrThrow({ where: { email: "aliou@x.com" } });
    expect(updated.status).toBe(UserStatus.ACTIVE);
    expect(updated.passwordHash).not.toBeNull();
    expect(updated.passwordHash).not.toBe("Hunter2Pass!"); // hashed
    expect(updated.activationToken).toBeNull();
    expect(updated.activationTokenExpiresAt).toBeNull();
    expect(updated.passwordSetAt).not.toBeNull();
  });

  it("rejects unknown token", async () => {
    const result = await activateAccount({
      token: "doesnotexist",
      password: "Hunter2Pass!",
      prisma: testPrisma,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalide|expir/i);
  });

  it("rejects expired token", async () => {
    const past = new Date(Date.now() - 60_000);
    await seedPendingUserWithToken("expiredtoken", past);
    const result = await activateAccount({
      token: "expiredtoken",
      password: "Hunter2Pass!",
      prisma: testPrisma,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/expir/i);
  });

  it("rejects password shorter than 8 chars", async () => {
    const future = new Date(Date.now() + 60_000);
    await seedPendingUserWithToken("token2", future);
    const result = await activateAccount({
      token: "token2",
      password: "short",
      prisma: testPrisma,
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
npm test -- tests/lib/server-actions/activate-account.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/lib/server-actions/activate-account.ts`:
```typescript
import { z } from "zod";
import { PrismaClient, UserStatus } from "@prisma/client";
import { hashPassword } from "@/lib/password";
import { isTokenExpired } from "@/lib/activation-token";

const PasswordSchema = z.string().min(8, "Mot de passe trop court (8 caractères minimum)");

export interface ActivateAccountInput {
  token: string;
  password: string;
  prisma: PrismaClient;
}

export interface ActivateAccountResult {
  success: boolean;
  userId?: string;
  error?: string;
}

export async function activateAccount(input: ActivateAccountInput): Promise<ActivateAccountResult> {
  const passCheck = PasswordSchema.safeParse(input.password);
  if (!passCheck.success) {
    return { success: false, error: passCheck.error.issues[0]?.message ?? "Mot de passe invalide" };
  }

  const user = await input.prisma.user.findUnique({ where: { activationToken: input.token } });
  if (!user) {
    return { success: false, error: "Lien d'activation invalide" };
  }

  if (isTokenExpired(user.activationTokenExpiresAt)) {
    return { success: false, error: "Lien d'activation expiré" };
  }

  const passwordHash = await hashPassword(input.password);

  await input.prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      status: UserStatus.ACTIVE,
      activationToken: null,
      activationTokenExpiresAt: null,
      passwordSetAt: new Date(),
    },
  });

  return { success: true, userId: user.id };
}
```

- [ ] **Step 4: Run test, verify pass**

```bash
npm test -- tests/lib/server-actions/activate-account.test.ts
```
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add activateAccount server action with tests"
```

---

## Task 10: Activation page

**Files:**
- Create: `src/app/activate/page.tsx`, `src/app/activate/activate-form.tsx`

- [ ] **Step 1: Create form (client)**

Create `src/app/activate/activate-form.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function ActivateForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Erreur");
      return;
    }
    router.push("/login?activated=1");
  }

  if (!token) {
    return <p className="text-sm text-red-400">Lien d'activation invalide (token manquant).</p>;
  }

  const inputCls = "w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100";
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="block text-sm mb-1 text-slate-300">Mot de passe</label>
        <input className={inputCls} type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div>
        <label className="block text-sm mb-1 text-slate-300">Confirmer le mot de passe</label>
        <input className={inputCls} type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-medium"
      >
        {loading ? "Activation..." : "Activer mon compte"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create page (server)**

Create `src/app/activate/page.tsx`:
```tsx
import { Suspense } from "react";
import { ActivateForm } from "./activate-form";

export default function ActivatePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-semibold text-center">Activer votre compte</h1>
        <Suspense fallback={null}>
          <ActivateForm />
        </Suspense>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Create API route**

Create `src/app/api/activate/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { activateAccount } from "@/lib/server-actions/activate-account";

export async function POST(req: Request) {
  const body = await req.json();
  const result = await activateAccount({
    token: String(body.token ?? ""),
    password: String(body.password ?? ""),
    prisma,
  });
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Update login page to show activation success banner**

Modify `src/app/login/login-form.tsx`. Find the `const initialError = params.get("error");` line. Right after it, add:
```typescript
  const activated = params.get("activated") === "1";
```

In the return JSX, right before the `<div>` for the Email field, add:
```tsx
      {activated && (
        <div className="text-sm text-green-400 bg-green-950/30 border border-green-900 rounded px-3 py-2">
          Compte activé. Vous pouvez maintenant vous connecter.
        </div>
      )}
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add activation page + API + login success banner"
```

---

## Task 11: PLATFORM_OWNER dashboard layout

**Files:**
- Create: `src/app/platform/layout.tsx`, `src/app/platform/page.tsx`, `src/components/platform/nav.tsx`, `src/components/platform/sign-out-button.tsx`

- [ ] **Step 1: Create sign-out button**

Create `src/components/platform/sign-out-button.tsx`:
```tsx
"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-sm text-slate-400 hover:text-slate-200"
    >
      Déconnexion
    </button>
  );
}
```

- [ ] **Step 2: Create nav**

Create `src/components/platform/nav.tsx`:
```tsx
import Link from "next/link";
import { SignOutButton } from "./sign-out-button";

export function PlatformNav() {
  return (
    <nav className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/platform" className="font-semibold text-slate-100">Platform</Link>
        <Link href="/platform" className="text-sm text-slate-400 hover:text-slate-200">Dashboard</Link>
        <Link href="/platform/tenants" className="text-sm text-slate-400 hover:text-slate-200">Tenants</Link>
      </div>
      <SignOutButton />
    </nav>
  );
}
```

- [ ] **Step 3: Create layout**

Create `src/app/platform/layout.tsx`:
```tsx
import { PlatformNav } from "@/components/platform/nav";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <PlatformNav />
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: Create dashboard home (stats)**

Create `src/app/platform/page.tsx`:
```tsx
import { prisma } from "@/lib/prisma";
import { TenantStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function PlatformDashboard() {
  const [total, pending, active, suspended, rejected] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { status: TenantStatus.PENDING } }),
    prisma.tenant.count({ where: { status: TenantStatus.ACTIVE } }),
    prisma.tenant.count({ where: { status: TenantStatus.SUSPENDED } }),
    prisma.tenant.count({ where: { status: TenantStatus.REJECTED } }),
  ]);

  const stats = [
    { label: "Total tenants", value: total, color: "text-slate-100" },
    { label: "En attente", value: pending, color: "text-amber-400" },
    { label: "Actifs", value: active, color: "text-green-400" },
    { label: "Suspendus", value: suspended, color: "text-orange-400" },
    { label: "Refusés", value: rejected, color: "text-red-400" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard plateforme</h1>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <div className="text-xs text-slate-400 uppercase">{s.label}</div>
            <div className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add PLATFORM_OWNER dashboard layout + stats home"
```

---

## Task 12: Tenants list + detail pages

**Files:**
- Create: `src/app/platform/tenants/page.tsx`, `src/app/platform/tenants/[id]/page.tsx`, `src/app/platform/tenants/[id]/actions.tsx`, `src/components/platform/tenant-status-badge.tsx`, `src/app/api/platform/tenants/[id]/validate/route.ts`, `src/app/api/platform/tenants/[id]/reject/route.ts`, `src/app/api/platform/tenants/[id]/suspend/route.ts`

- [ ] **Step 1: Create status badge component**

Create `src/components/platform/tenant-status-badge.tsx`:
```tsx
import { TenantStatus } from "@prisma/client";

const STYLES: Record<TenantStatus, string> = {
  PENDING: "bg-amber-950 text-amber-300 border-amber-900",
  ACTIVE: "bg-green-950 text-green-300 border-green-900",
  SUSPENDED: "bg-orange-950 text-orange-300 border-orange-900",
  REJECTED: "bg-red-950 text-red-300 border-red-900",
};

const LABELS: Record<TenantStatus, string> = {
  PENDING: "En attente",
  ACTIVE: "Actif",
  SUSPENDED: "Suspendu",
  REJECTED: "Refusé",
};

export function TenantStatusBadge({ status }: { status: TenantStatus }) {
  return (
    <span className={`inline-block text-xs font-medium px-2 py-1 rounded border ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
```

- [ ] **Step 2: Create tenants list page**

Create `src/app/platform/tenants/page.tsx`:
```tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TenantStatusBadge } from "@/components/platform/tenant-status-badge";
import { TenantStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function TenantsList({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const statusFilter = (searchParams.status as TenantStatus | undefined) ?? undefined;
  const tenants = await prisma.tenant.findMany({
    where: statusFilter ? { status: statusFilter } : undefined,
    orderBy: { createdAt: "desc" },
  });

  const filters: Array<{ label: string; value?: TenantStatus }> = [
    { label: "Tous" },
    { label: "En attente", value: TenantStatus.PENDING },
    { label: "Actifs", value: TenantStatus.ACTIVE },
    { label: "Suspendus", value: TenantStatus.SUSPENDED },
    { label: "Refusés", value: TenantStatus.REJECTED },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Tenants</h1>

      <div className="flex gap-2 text-sm">
        {filters.map((f) => {
          const href = f.value ? `/platform/tenants?status=${f.value}` : "/platform/tenants";
          const active = statusFilter === f.value || (!statusFilter && !f.value);
          return (
            <Link
              key={f.label}
              href={href}
              className={`px-3 py-1 rounded border ${
                active ? "border-blue-600 text-blue-300" : "border-slate-700 text-slate-400 hover:border-slate-600"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-400 border-b border-slate-800">
            <tr>
              <th className="px-4 py-3 text-left">Organisation</th>
              <th className="px-4 py-3 text-left">Propriétaire</th>
              <th className="px-4 py-3 text-left">Ville</th>
              <th className="px-4 py-3 text-left">Statut</th>
              <th className="px-4 py-3 text-left">Créé</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {tenants.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Aucun tenant</td></tr>
            )}
            {tenants.map((t) => (
              <tr key={t.id} className="border-b border-slate-800 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-100">{t.name}</td>
                <td className="px-4 py-3 text-slate-300">{t.ownerEmail}</td>
                <td className="px-4 py-3 text-slate-400">{t.city}</td>
                <td className="px-4 py-3"><TenantStatusBadge status={t.status} /></td>
                <td className="px-4 py-3 text-slate-400">{t.createdAt.toLocaleDateString("fr-FR")}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/platform/tenants/${t.id}`} className="text-blue-400 hover:text-blue-300">
                    Voir →
                  </Link>
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

- [ ] **Step 3: Create API routes for actions**

Create `src/app/api/platform/tenants/[id]/validate/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { validateTenant } from "@/lib/server-actions/tenant-validation";
import { sendEmail, buildActivationEmail } from "@/lib/email";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.PLATFORM_OWNER) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const result = await validateTenant({
    tenantId: params.id,
    platformOwnerId: ctx.userId,
    prisma,
  });
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Send activation email to owner
  const owner = await prisma.user.findFirst({
    where: { tenantId: params.id, role: Role.TENANT_ADMIN },
  });
  if (owner && result.activationUrl) {
    const email = buildActivationEmail({
      recipientName: owner.name,
      activationUrl: result.activationUrl,
    });
    await sendEmail({ to: owner.email, ...email });
  }

  return NextResponse.json({ ok: true, activationUrl: result.activationUrl });
}
```

Create `src/app/api/platform/tenants/[id]/reject/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { rejectTenant } from "@/lib/server-actions/tenant-validation";
import { sendEmail, buildRejectionEmail } from "@/lib/email";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.PLATFORM_OWNER) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const reason = String(body.reason ?? "");
  const result = await rejectTenant({
    tenantId: params.id,
    platformOwnerId: ctx.userId,
    reason,
    prisma,
  });
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: params.id } });
  const owner = await prisma.user.findFirst({
    where: { tenantId: params.id, role: Role.TENANT_ADMIN },
  });
  if (tenant && owner) {
    const email = buildRejectionEmail({
      recipientName: owner.name,
      organizationName: tenant.name,
      reason,
    });
    await sendEmail({ to: owner.email, ...email });
  }

  return NextResponse.json({ ok: true });
}
```

Create `src/app/api/platform/tenants/[id]/suspend/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { suspendTenant } from "@/lib/server-actions/tenant-validation";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.PLATFORM_OWNER) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const result = await suspendTenant({
    tenantId: params.id,
    platformOwnerId: ctx.userId,
    prisma,
  });
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Create tenant detail actions (client)**

Create `src/app/platform/tenants/[id]/actions.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TenantStatus } from "@prisma/client";

export function TenantActions({ id, status }: { id: string; status: TenantStatus }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [activationLink, setActivationLink] = useState<string | null>(null);

  async function call(path: string, body?: object) {
    setError(null);
    setLoading(path);
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    setLoading(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Erreur");
      return null;
    }
    return res.json();
  }

  async function onValidate() {
    const j = await call(`/api/platform/tenants/${id}/validate`);
    if (j?.activationUrl) setActivationLink(j.activationUrl);
    router.refresh();
  }

  async function onReject() {
    if (!reason.trim()) { setError("Raison requise"); return; }
    await call(`/api/platform/tenants/${id}/reject`, { reason });
    setShowRejectForm(false);
    router.refresh();
  }

  async function onSuspend() {
    if (!confirm("Suspendre ce tenant ?")) return;
    await call(`/api/platform/tenants/${id}/suspend`);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-400">{error}</p>}
      {activationLink && (
        <div className="text-sm bg-blue-950 border border-blue-900 rounded p-3 text-blue-200 break-all">
          Lien d'activation (envoyé par email) : <span className="font-mono">{activationLink}</span>
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        {status === TenantStatus.PENDING && (
          <>
            <button onClick={onValidate} disabled={loading !== null}
              className="px-4 py-2 rounded bg-green-600 hover:bg-green-500 disabled:opacity-50 text-sm font-medium">
              {loading?.includes("validate") ? "..." : "Valider"}
            </button>
            <button onClick={() => setShowRejectForm((v) => !v)}
              className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-sm font-medium">
              Refuser
            </button>
          </>
        )}
        {status === TenantStatus.ACTIVE && (
          <button onClick={onSuspend} disabled={loading !== null}
            className="px-4 py-2 rounded bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-sm font-medium">
            Suspendre
          </button>
        )}
      </div>

      {showRejectForm && (
        <div className="space-y-2 bg-slate-900 border border-slate-800 rounded p-3">
          <label className="block text-sm text-slate-300">Raison du refus</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
            className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-slate-100 text-sm" />
          <button onClick={onReject} disabled={loading !== null}
            className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 disabled:opacity-50 text-sm font-medium">
            Confirmer le refus
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create tenant detail page**

Create `src/app/platform/tenants/[id]/page.tsx`:
```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TenantStatusBadge } from "@/components/platform/tenant-status-badge";
import { TenantActions } from "./actions";

export const dynamic = "force-dynamic";

export default async function TenantDetail({ params }: { params: { id: string } }) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: params.id },
    include: {
      users: { where: { role: "TENANT_ADMIN" }, take: 1 },
      gyms: true,
    },
  });
  if (!tenant) notFound();

  const owner = tenant.users[0];

  return (
    <div className="space-y-6">
      <Link href="/platform/tenants" className="text-sm text-slate-400 hover:text-slate-200">← Tenants</Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{tenant.name}</h1>
          <p className="text-sm text-slate-400 mt-1">Slug : <span className="font-mono">{tenant.slug}</span></p>
        </div>
        <TenantStatusBadge status={tenant.status} />
      </div>

      {tenant.rejectionReason && (
        <div className="text-sm bg-red-950/30 border border-red-900 rounded p-3 text-red-300">
          Refusé : {tenant.rejectionReason}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded p-4">
          <div className="text-xs text-slate-400 uppercase mb-2">Propriétaire</div>
          <div className="text-slate-100">{owner?.name ?? "—"}</div>
          <div className="text-sm text-slate-400">{tenant.ownerEmail}</div>
          <div className="text-sm text-slate-400">{tenant.ownerPhone}</div>
          <div className="text-sm text-slate-400 mt-2">Ville : {tenant.city}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded p-4">
          <div className="text-xs text-slate-400 uppercase mb-2">Plan</div>
          <div className="text-slate-100">{tenant.monthlyPricePerGym.toLocaleString("fr-FR")} F / salle / mois</div>
          <div className="text-sm text-slate-400">Salles : {tenant.gyms.length}</div>
          {tenant.trialEndsAt && (
            <div className="text-sm text-slate-400 mt-2">
              Essai jusqu'au {tenant.trialEndsAt.toLocaleDateString("fr-FR")}
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Actions</h2>
        <TenantActions id={tenant.id} status={tenant.status} />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify build**

```bash
npm run build
```
Expected: success.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add tenants list + detail pages with validate/reject/suspend actions"
```

---

## Task 13: First-gym wizard for TENANT_ADMIN (TDD + UI)

**Files:**
- Create: `src/lib/server-actions/create-first-gym.ts`, `tests/lib/server-actions/create-first-gym.test.ts`, `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`, `src/app/admin/onboarding/page.tsx`, `src/app/admin/onboarding/wizard.tsx`, `src/app/api/admin/onboarding/route.ts`, `src/components/admin/nav.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/lib/server-actions/create-first-gym.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, resetDb } from "../../helpers/db";
import { createFirstGym } from "@/lib/server-actions/create-first-gym";
import { Role, TenantStatus, UserStatus } from "@prisma/client";

async function seedActiveTenant() {
  const tenant = await testPrisma.tenant.create({
    data: {
      name: "FitClub", slug: "fitclub", ownerEmail: "a@x.com", ownerPhone: "1",
      city: "Dakar", status: TenantStatus.ACTIVE,
    },
  });
  const admin = await testPrisma.user.create({
    data: {
      name: "Aliou", email: "a@x.com", passwordHash: "hash",
      role: Role.TENANT_ADMIN, status: UserStatus.ACTIVE, tenantId: tenant.id,
    },
  });
  return { tenant, admin };
}

describe("createFirstGym", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("creates a gym scoped to the tenant", async () => {
    const { tenant, admin } = await seedActiveTenant();
    const result = await createFirstGym({
      tenantId: tenant.id,
      userId: admin.id,
      name: "FitClub Plateau",
      address: "123 rue X",
      city: "Dakar",
      phone: "+221770000000",
      latitude: 14.7,
      longitude: -17.4,
      prisma: testPrisma,
    });
    expect(result.success).toBe(true);
    const gyms = await testPrisma.gym.findMany();
    expect(gyms).toHaveLength(1);
    expect(gyms[0].tenantId).toBe(tenant.id);
    expect(gyms[0].name).toBe("FitClub Plateau");
    expect(gyms[0].qrToken).toBeTypeOf("string");
    expect(gyms[0].qrToken.length).toBeGreaterThan(10);
  });

  it("rejects when tenant is not ACTIVE", async () => {
    const { tenant, admin } = await seedActiveTenant();
    await testPrisma.tenant.update({ where: { id: tenant.id }, data: { status: TenantStatus.SUSPENDED } });
    const result = await createFirstGym({
      tenantId: tenant.id, userId: admin.id,
      name: "X", address: "x", city: "x", phone: "1",
      latitude: 0, longitude: 0, prisma: testPrisma,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", async () => {
    const { tenant, admin } = await seedActiveTenant();
    const result = await createFirstGym({
      tenantId: tenant.id, userId: admin.id,
      name: "", address: "x", city: "x", phone: "1",
      latitude: 0, longitude: 0, prisma: testPrisma,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid coordinates", async () => {
    const { tenant, admin } = await seedActiveTenant();
    const result = await createFirstGym({
      tenantId: tenant.id, userId: admin.id,
      name: "X", address: "x", city: "x", phone: "1",
      latitude: 999, longitude: 0, prisma: testPrisma,
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
npm test -- tests/lib/server-actions/create-first-gym.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/lib/server-actions/create-first-gym.ts`:
```typescript
import { z } from "zod";
import { PrismaClient, TenantStatus } from "@prisma/client";

const GymSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  address: z.string().min(1, "Adresse requise"),
  city: z.string().min(1, "Ville requise"),
  phone: z.string().min(5, "Téléphone requis"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export interface CreateFirstGymInput {
  tenantId: string;
  userId: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  latitude: number;
  longitude: number;
  prisma: PrismaClient;
}

export async function createFirstGym(
  input: CreateFirstGymInput
): Promise<{ success: boolean; gymId?: string; error?: string }> {
  const parsed = GymSchema.safeParse({
    name: input.name, address: input.address, city: input.city,
    phone: input.phone, latitude: input.latitude, longitude: input.longitude,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const tenant = await input.prisma.tenant.findUnique({ where: { id: input.tenantId } });
  if (!tenant) return { success: false, error: "Tenant introuvable" };
  if (tenant.status !== TenantStatus.ACTIVE) {
    return { success: false, error: "Tenant non actif" };
  }

  const gym = await input.prisma.gym.create({
    data: { tenantId: input.tenantId, ...parsed.data },
  });

  return { success: true, gymId: gym.id };
}
```

- [ ] **Step 4: Run test, verify pass**

```bash
npm test -- tests/lib/server-actions/create-first-gym.test.ts
```
Expected: 4 tests PASS.

- [ ] **Step 5: Create admin nav**

Create `src/components/admin/nav.tsx`:
```tsx
import Link from "next/link";
import { SignOutButton } from "@/components/platform/sign-out-button";

export function AdminNav() {
  return (
    <nav className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/admin" className="font-semibold text-slate-100">Admin</Link>
        <Link href="/admin" className="text-sm text-slate-400 hover:text-slate-200">Dashboard</Link>
      </div>
      <SignOutButton />
    </nav>
  );
}
```

- [ ] **Step 6: Create admin layout**

Create `src/app/admin/layout.tsx`:
```tsx
import { AdminNav } from "@/components/admin/nav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AdminNav />
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 7: Create admin dashboard with redirect to wizard**

Create `src/app/admin/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId) redirect("/login");

  const gymCount = await prisma.gym.count({ where: { tenantId: ctx.tenantId } });
  if (gymCount === 0) {
    redirect("/admin/onboarding");
  }

  const gyms = await prisma.gym.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard organisation</h1>
      <div>
        <h2 className="text-lg font-semibold mb-3">Vos salles ({gyms.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {gyms.map((g) => (
            <div key={g.id} className="bg-slate-900 border border-slate-800 rounded p-4">
              <div className="font-medium text-slate-100">{g.name}</div>
              <div className="text-sm text-slate-400">{g.address} — {g.city}</div>
              <div className="text-xs text-slate-500 mt-2 font-mono">QR token: {g.qrToken.slice(0, 12)}…</div>
            </div>
          ))}
        </div>
        <Link href="/admin/onboarding" className="inline-block mt-4 px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-sm font-medium">
          + Ajouter une salle
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Create onboarding wizard**

Create `src/app/admin/onboarding/wizard.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GymWizard() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "", address: "", city: "", phone: "",
    latitude: "", longitude: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function useMyLocation() {
    setError(null);
    if (!navigator.geolocation) { setError("Géolocalisation non supportée"); return; }
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
    const res = await fetch("/api/admin/onboarding", {
      method: "POST",
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
    router.push("/admin");
    router.refresh();
  }

  const inputCls = "w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100";
  return (
    <form onSubmit={onSubmit} className="space-y-3 max-w-lg">
      <div>
        <label className="block text-sm mb-1 text-slate-300">Nom de la salle</label>
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
        {loading ? "Création..." : "Créer ma salle"}
      </button>
    </form>
  );
}
```

- [ ] **Step 9: Create onboarding page**

Create `src/app/admin/onboarding/page.tsx`:
```tsx
import { GymWizard } from "./wizard";

export default function OnboardingPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Ajouter une salle</h1>
        <p className="text-sm text-slate-400 mt-1">
          Configurez votre première salle. La géolocalisation sera utilisée pour vérifier
          les check-ins des membres.
        </p>
      </div>
      <GymWizard />
    </div>
  );
}
```

- [ ] **Step 10: Create onboarding API route**

Create `src/app/api/admin/onboarding/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createFirstGym } from "@/lib/server-actions/create-first-gym";

export async function POST(req: Request) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.TENANT_ADMIN || !ctx.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const result = await createFirstGym({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    name: String(body.name ?? ""),
    address: String(body.address ?? ""),
    city: String(body.city ?? ""),
    phone: String(body.phone ?? ""),
    latitude: Number(body.latitude),
    longitude: Number(body.longitude),
    prisma,
  });
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, gymId: result.gymId });
}
```

- [ ] **Step 11: Verify build**

```bash
npm run build
```
Expected: success.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: add first-gym wizard + admin dashboard with auto-redirect"
```

---

## Task 14: End-to-end manual verification

- [ ] **Step 1: Reset DB and reseed**

```bash
npm run db:reset
# Confirm with "y"
npm run db:seed
```
Expected: clean DB with only PLATFORM_OWNER.

- [ ] **Step 2: All tests pass**

```bash
npm test
```
Expected: 13 (from Plan 1) + 8 (slug) + 5 (token) + 6 (signup) + 9 (validation) + 4 (activate) + 4 (gym) = 49 tests, all PASS. (Test counts approximate — confirm all green.)

- [ ] **Step 3: Typecheck and build**

```bash
npm run typecheck
npm run build
```
Expected: both succeed.

- [ ] **Step 4: Manual smoke test full flow**

```bash
npm run dev
```

1. Open http://localhost:3000/signup → fill: "FitClub Dakar", "Aliou Diop", "aliou@fitclub.sn", "+221771234567", "Dakar" → submit → see "Demande envoyée ✓".

2. Open http://localhost:3000/login → login as `owner@platform.local` / `ChangeMe123!` → redirected to `/` (landing).

3. Manually visit http://localhost:3000/platform → dashboard appears with stats (Total 1, En attente 1).

4. Navigate to "Tenants" → see "FitClub Dakar" with badge "En attente".

5. Click "Voir" → tenant detail page. Click "Valider".

6. **Check your server console** — you should see the dev-fallback email log:
   ```
   📧 EMAIL (dev fallback...)
     To: aliou@fitclub.sn
     Subject: Activez votre compte...
     Text: ... http://localhost:3000/activate?token=XXXXX ...
   ```
   Also the page shows the activation link inline.

7. Copy the activation URL into another browser tab (or incognito). Set password "Hunter2Pass!" twice → submit → redirected to `/login?activated=1` with success banner.

8. Login as `aliou@fitclub.sn` / `Hunter2Pass!` → redirected to `/admin/onboarding` (wizard).

9. Fill wizard: "FitClub Plateau", address, city Dakar, phone, click "📍 Utiliser ma position" (or type lat=14.7, lon=-17.4) → submit → redirected to `/admin` → see the new gym card.

10. Kill server.

- [ ] **Step 5: Verify DB state**

```bash
psql gym_management -c "SELECT name, status FROM \"Tenant\";"
psql gym_management -c "SELECT email, role, status FROM \"User\";"
psql gym_management -c "SELECT name, \"qrToken\" FROM \"Gym\";"
```
Expected: 1 ACTIVE tenant, 2 ACTIVE users (owner + Aliou), 1 gym.

- [ ] **Step 6: Final commit**

```bash
git add -A
git status
# If clean, skip. Otherwise:
git commit -m "chore: onboarding + platform dashboard milestone"
```

---

## Done criteria

- [ ] All tests pass (~36 new + 13 from Plan 1)
- [ ] `npm run build` succeeds
- [ ] `npm run typecheck` passes
- [ ] Full flow works manually: signup → validate → activation email → set password → login → wizard → gym created
- [ ] PLATFORM_OWNER can validate, reject (with reason), and suspend tenants from UI

## What's next (Plan 3)

TENANT_ADMIN + MANAGER dashboards:
- Multi-gym management (CRUD additional gyms)
- Manager creation + assignment to gym
- Plan/Subscription CRUD per gym
- Member CRUD with photo upload
- Subscription assignment to members
