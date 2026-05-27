# Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy Gym Management SaaS on a Ubuntu/Debian VPS via Docker Compose, and publish the Android app to the Play Store via EAS Build.

**Architecture:** Next.js app + PostgreSQL run as Docker Compose services on the VPS. The app uses Next.js standalone output for a minimal production image. Node_modules are included in the runner stage to support `prisma migrate deploy` and `tsx prisma/seed.ts` post-startup.

**Tech Stack:** Docker, Docker Compose, PostgreSQL 16, Node 20 Alpine, Next.js standalone, EAS Build (Expo), Google Play Console

---

## Phase 1 — VPS Docker Deployment

### Task 1: Enable Next.js standalone output

**Files:**
- Modify: `next.config.mjs`

- [ ] **Step 1: Add standalone output**

```js
/** @type {import('next').NextConfig} */
const nextConfig = { output: 'standalone' };
export default nextConfig;
```

- [ ] **Step 2: Verify build succeeds locally**

```bash
npm run build
```

Expected: build completes, `.next/standalone/` directory created. No errors.

- [ ] **Step 3: Verify tests still pass**

```bash
npm test
```

Expected: `132 passed (132)`

- [ ] **Step 4: Commit**

```bash
git add next.config.mjs
git commit -m "feat(deploy): enable Next.js standalone output for Docker"
```

---

### Task 2: Create .dockerignore

**Files:**
- Create: `.dockerignore`

- [ ] **Step 1: Create .dockerignore**

```
node_modules
.next
.git
.env
.env.local
.env.*.local
mobile
npm-debug.log*
*.md
!README.md
docs
tests
```

- [ ] **Step 2: Commit**

```bash
git add .dockerignore
git commit -m "chore(deploy): add .dockerignore"
```

---

### Task 3: Create Dockerfile (multi-stage)

**Files:**
- Create: `Dockerfile`

- [ ] **Step 1: Create Dockerfile**

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies (all, including devDeps for prisma generate + tsx)
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build-time env vars for NEXT_PUBLIC_* (baked into JS bundle at build)
ARG NEXT_PUBLIC_PUSHER_KEY
ARG NEXT_PUBLIC_PUSHER_CLUSTER
ENV NEXT_PUBLIC_PUSHER_KEY=$NEXT_PUBLIC_PUSHER_KEY
ENV NEXT_PUBLIC_PUSHER_CLUSTER=$NEXT_PUBLIC_PUSHER_CLUSTER

# Generate Prisma client then build Next.js
RUN npx prisma generate
RUN npm run build

# ─────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Standalone Next.js bundle
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Full node_modules needed for: prisma migrate deploy + tsx prisma/seed.ts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
```

- [ ] **Step 2: Test Docker build locally**

```bash
docker build -t gym-management-test .
```

Expected: build succeeds, image created. If Docker not installed locally, skip to Task 5.

- [ ] **Step 3: Commit**

```bash
git add Dockerfile
git commit -m "feat(deploy): add multi-stage Dockerfile"
```

---

### Task 4: Create docker-compose.yml and .env.example

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`

- [ ] **Step 1: Create docker-compose.yml**

```yaml
version: '3.8'

services:
  db:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      args:
        NEXT_PUBLIC_PUSHER_KEY: ${NEXT_PUBLIC_PUSHER_KEY:-}
        NEXT_PUBLIC_PUSHER_CLUSTER: ${NEXT_PUBLIC_PUSHER_CLUSTER:-eu}
    restart: always
    ports:
      - "3000:3000"
    env_file: .env
    depends_on:
      db:
        condition: service_healthy

volumes:
  postgres_data:
```

- [ ] **Step 2: Create .env.example**

```bash
# ─── Application ───────────────────────────────────────────────
DATABASE_URL=postgresql://gymapp:CHANGE_ME@db:5432/gym_management
NEXTAUTH_SECRET=CHANGE_ME_run_openssl_rand_-base64_32
NEXTAUTH_URL=http://YOUR_VPS_IP:3000
APP_URL=http://YOUR_VPS_IP:3000

# ─── Email (Resend) ────────────────────────────────────────────
RESEND_API_KEY=
EMAIL_FROM=Gym SaaS <no-reply@example.com>

# ─── Cron ──────────────────────────────────────────────────────
CRON_SECRET=CHANGE_ME_run_openssl_rand_-base64_32

# ─── Pusher (optionnel) ────────────────────────────────────────
PUSHER_APP_ID=
PUSHER_KEY=
PUSHER_SECRET=
PUSHER_CLUSTER=eu
NEXT_PUBLIC_PUSHER_KEY=
NEXT_PUBLIC_PUSHER_CLUSTER=eu

# ─── WhatsApp (optionnel) ──────────────────────────────────────
WHATSAPP_PHONE_ID=
WHATSAPP_TOKEN=

# ─── PostgreSQL (utilisé par docker-compose) ───────────────────
POSTGRES_USER=gymapp
POSTGRES_PASSWORD=CHANGE_ME_strong_password
POSTGRES_DB=gym_management
```

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "feat(deploy): add docker-compose.yml and .env.example"
```

---

### Task 5: Push code to remote repository

- [ ] **Step 1: Verify remote exists**

```bash
git remote -v
```

If no remote, add one:
```bash
git remote add origin https://github.com/TON_USER/gym-management.git
```

- [ ] **Step 2: Push main branch**

```bash
git push -u origin main
```

Expected: code pushed successfully.

---

### Task 6: Provision VPS and deploy

> Run these commands over SSH on the VPS.

- [ ] **Step 1: SSH into VPS**

```bash
ssh user@IP_VPS
```

- [ ] **Step 2: Install Docker and Docker Compose**

```bash
sudo apt update && sudo apt install -y docker.io docker-compose git
sudo usermod -aG docker $USER
newgrp docker
```

- [ ] **Step 3: Clone repository**

```bash
git clone https://github.com/TON_USER/gym-management.git /opt/gym-management
cd /opt/gym-management
```

- [ ] **Step 4: Create .env file with production secrets**

```bash
cp .env.example .env
nano .env
```

Fill in each `CHANGE_ME` value. Generate secrets:
```bash
# NEXTAUTH_SECRET
openssl rand -base64 32

# CRON_SECRET
openssl rand -base64 32

# POSTGRES_PASSWORD — choose a strong password
```

Set `NEXTAUTH_URL` and `APP_URL` to `http://IP_VPS:3000` (replace `IP_VPS` with real IP).
Set `DATABASE_URL` to `postgresql://gymapp:YOUR_POSTGRES_PASSWORD@db:5432/gym_management`.

- [ ] **Step 5: Build and start containers**

```bash
docker-compose up -d --build
```

Expected: downloads postgres:16-alpine, builds app image (~3-5 min first time), starts both containers.

- [ ] **Step 6: Verify containers running**

```bash
docker-compose ps
```

Expected output:
```
NAME                   STATUS
gym-management-app-1   Up (healthy)
gym-management-db-1    Up (healthy)
```

- [ ] **Step 7: Run database migrations**

```bash
docker-compose exec app npx prisma migrate deploy
```

Expected: `All migrations have been successfully applied.`

- [ ] **Step 8: Seed PLATFORM_OWNER**

```bash
docker-compose exec app npx tsx prisma/seed.ts
```

Expected: seed completes, `owner@platform.local` created.

- [ ] **Step 9: Smoke test — check app responds**

```bash
curl http://localhost:3000
```

Expected: HTML response (landing page). If not, check logs:
```bash
docker-compose logs app --tail=50
```

- [ ] **Step 10: Test login from browser**

Open `http://IP_VPS:3000/login` in browser.
Login: `owner@platform.local` / `ChangeMe123!`
Expected: redirect to `/platform` dashboard.

---

### Task 7: Verify firewall allows port 3000

- [ ] **Step 1: Allow port 3000 on VPS**

```bash
sudo ufw allow 3000/tcp
sudo ufw status
```

Expected: port 3000 listed as ALLOW.

- [ ] **Step 2: Test from external machine**

From your Mac, open `http://IP_VPS:3000` in browser.
Expected: landing page visible.

---

## Phase 2 — Mobile Android → Play Store

### Task 8: Update mobile API URL to VPS

**Files:**
- Modify: `mobile/app.json`

- [ ] **Step 1: Update apiBaseUrl**

In `mobile/app.json`, change:
```json
"extra": {
  "apiBaseUrl": "http://IP_VPS:3000",
  "eas": {
    "projectId": "2100647f-5326-498b-952c-5309585bc7af"
  }
}
```

Replace `IP_VPS` with the real VPS IP address.

- [ ] **Step 2: Commit**

```bash
git add mobile/app.json
git commit -m "feat(mobile): update apiBaseUrl to production VPS IP"
git push origin main
```

---

### Task 9: Build production AAB with EAS

- [ ] **Step 1: Install EAS CLI**

```bash
npm install -g eas-cli
```

- [ ] **Step 2: Login to Expo**

```bash
eas login
```

Enter Expo account credentials (create free account at expo.dev if needed).

- [ ] **Step 3: Build production AAB**

```bash
cd /Users/admin/gym-management/mobile
eas build --platform android --profile production
```

Expected: Expo uploads code, builds in cloud (~10-15 min). At end, provides download URL for `.aab` file.

- [ ] **Step 4: Download the .aab file**

Download via the URL shown in terminal, or from expo.dev → project → builds.
Save as `gym-management-production.aab`.

---

### Task 10: Submit to Google Play Store

> Manual steps in Google Play Console browser UI.

- [ ] **Step 1: Create Google Play Developer account**

Go to: `play.google.com/console`
Pay: 25 USD (one-time, not recurring)
Complete identity verification.

- [ ] **Step 2: Create new application**

In Play Console:
- Click "Create app"
- App name: `Gym Management`
- Default language: `French (fr-FR)`
- App or game: `App`
- Free or paid: `Free`
- Accept policies → "Create app"

- [ ] **Step 3: Fill store listing**

In "Store presence" → "Main store listing":

- **Short description** (max 80 chars): `Gestion de salle de sport — membres, abonnements, check-in QR`
- **Full description** (max 4000 chars): describe features (members, subscriptions, QR check-in, payments Wave/OM, dashboard)
- **App icon**: 512×512 PNG (high-res icon from `mobile/assets/icon.png`)
- **Screenshots**: minimum 2 Android phone screenshots (1080×1920 or similar)
  - Tip: run app in emulator, take screenshots with `adb exec-out screencap -p > screen.png`

- [ ] **Step 4: Fill content rating**

"Policy" → "App content" → "Content rating"
Complete questionnaire → rating assigned automatically.

- [ ] **Step 5: Upload AAB**

"Release" → "Testing" → "Internal testing" → "Create new release"
- Upload `gym-management-production.aab`
- Release name: `1.0.3`
- Release notes: `Version initiale`
- Save → Review → Start rollout to Internal testing

Verify app installs on a test device via internal testing link.

- [ ] **Step 6: Promote to Production**

Once internal test verified:
"Release" → "Production" → "Create new release"
- Promote from internal testing
- Set rollout percentage: 100%
- Submit for review

Expected: Google review takes 1-3 business days. Email notification when approved/rejected.

---

## Update procedure (future deployments)

### VPS update

```bash
ssh user@IP_VPS
cd /opt/gym-management
git pull
docker-compose up -d --build
docker-compose exec app npx prisma migrate deploy
```

### Mobile update

1. Bump `"version"` in `mobile/app.json` (e.g. `1.0.4`)
2. Build new AAB: `eas build --platform android --profile production`
3. Upload to Play Console → Production → New release
