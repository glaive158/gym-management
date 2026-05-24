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
   DATABASE_URL="postgresql://admin@localhost:5432/gym_management_test?schema=public" npx prisma migrate deploy
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
