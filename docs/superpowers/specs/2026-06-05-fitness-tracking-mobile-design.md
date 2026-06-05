# Fitness Tracking — Persistance DB + App Mobile

**Date** : 2026-06-05
**Statut** : Design validé
**Branche** : `feat/fitness-tracking-mobile`

## Problème

Le suivi performance (fitness tracker) existe côté web (`/me/fitness`) mais :
1. **N'existe pas dans l'app mobile** Android.
2. **Stocke tout en localStorage** (`useFitApp`, clé `fitapp_v3`) — données perdues si désinstall / changement d'appareil, jamais synchronisées entre web et mobile.

## Objectif

- Persister le suivi fitness en **DB PostgreSQL** (profil, pesées, sommeil, séances, progression hebdo).
- Exposer via **APIs REST dual-auth** (web NextAuth + mobile JWT bearer).
- Migrer le web de localStorage → DB (interface `useFitApp` inchangée).
- Ajouter un **écran fitness mobile** complet (Programme / Muscu / Marche / Poids).

## Modèle de données (`prisma/schema.prisma`)

```prisma
model FitnessProfile {
  id            String   @id @default(cuid())
  memberId      String   @unique
  tenantId      String
  startWeightKg Float
  goalWeightKg  Float
  durationWeeks Int      // 4 | 8 | 12
  startDate     DateTime
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  member        User     @relation(fields: [memberId], references: [id], onDelete: Cascade)
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
  member     User     @relation(fields: [memberId], references: [id], onDelete: Cascade)
  @@index([memberId, date])
}

model FitnessWorkoutSession {
  id          String   @id @default(cuid())
  memberId    String
  tenantId    String
  date        DateTime
  programId   String?  // null pour la marche
  programName String
  durationMin Int
  kind        String   // "muscu" | "marche"
  createdAt   DateTime @default(now())
  member      User     @relation(fields: [memberId], references: [id], onDelete: Cascade)
  @@index([memberId, date])
}

model FitnessDayProgress {
  id        String  @id @default(cuid())
  memberId  String
  tenantId  String
  weekIndex Int
  dayIndex  Int     // 0..6 (Lun..Dim)
  done      Boolean @default(false)
  member    User    @relation(fields: [memberId], references: [id], onDelete: Cascade)
  @@unique([memberId, weekIndex, dayIndex])
  @@index([memberId])
}
```

Relations inverses ajoutées sur `User`. Ces modèles **ne sont PAS** dans `TENANT_SCOPED_MODELS` — scoping tenant fait manuellement via clauses `where` (même convention que `FitnessProgram`/`FitnessExercise`).

## Server actions (`src/lib/server-actions/fitness-tracking.ts`)

Fonctions pures, acceptent `prisma` en paramètre, retour `{ success, data?, error? }`, messages d'erreur en français. Scoping tenant manuel.

- `getFitnessData({ memberId, tenantId, prisma })` → `FitAppData` ({ profile, weekData, weights, sleeps, sessions })
- `upsertProfile({ memberId, tenantId, startWeightKg, goalWeightKg, durationWeeks, startDate, prisma })`
  - À la création, génère les `FitnessDayProgress` rows selon `WEEKLY_SCHEDULE` × `durationWeeks` (dans une `$transaction`).
- `addWeightLog({ memberId, tenantId, date, weightKg, sleepHours?, prisma })`
- `addWorkoutSession({ memberId, tenantId, date, programId?, programName, durationMin, kind, prisma })`
- `toggleDayProgress({ memberId, tenantId, weekIndex, dayIndex, prisma })`

`weekData` reconstruit depuis `FitnessDayProgress` + `WEEKLY_SCHEDULE` (libellés/types/durée viennent du schedule statique, seul `done` vient de la DB).

## APIs REST (`src/app/api/me/fitness/...`)

Dual-auth selon le pattern existant `programs/route.ts` (essaie `getCurrentAuthContext`, fallback `authMobileRequest`).

| Méthode | Route | Action |
|---------|-------|--------|
| GET  | `/api/me/fitness/data`         | `getFitnessData` → FitAppData |
| POST | `/api/me/fitness/profile`      | `upsertProfile` |
| POST | `/api/me/fitness/weights`      | `addWeightLog` |
| POST | `/api/me/fitness/sessions`     | `addWorkoutSession` |
| POST | `/api/me/fitness/day-progress` | `toggleDayProgress` |

`/api/me/fitness/programs` (existant) reste inchangé.

## Refactor web (`src/hooks/use-fit-app.ts`)

- Remplace lecture/écriture localStorage par fetch des APIs.
- **Garde l'interface publique identique** (`data`, `loaded`, `setProfile`, `toggleDay`, `addWeight`, `addSession`, `reset`) → composants `tab-*.tsx` inchangés.
- Mutations optimistes : maj state local immédiat + POST en arrière-plan (best-effort, re-fetch en cas d'erreur).
- **Migration one-shot** : au premier load, si `localStorage["fitapp_v3"]` existe et aucun profil DB, POST les données locales vers la DB puis supprime la clé. Best-effort, jamais throw.

## Mobile

### Écran (`mobile/src/screens/FitnessScreen.tsx`)
- Segmented control 4 onglets : **Programme** / **Muscu** / **Marche** / **Poids**.
- Réimplémentation React Native des composants web (`tab-program`, `tab-muscu` + session overlay/timers, `tab-walk`, `tab-weight`).
- Timers via `setInterval` + état local (identique logique web : marche japonaise 2min/3min cycles, repos muscu).

### Hook (`mobile/src/hooks/useFitApp.ts`)
- Fetch les APIs (pas d'AsyncStorage). Même forme de données que le web.
- Utilise le client API mobile existant (token JWT bearer, `apiBaseUrl`).

### Navigation (`mobile/src/navigation/AppNavigator.tsx`)
- Nouveau `Tab.Screen` **"Forme"**, icône Ionicons `barbell-outline`.

## Tests

`tests/lib/server-actions/fitness-tracking.test.ts` (vitest + PostgreSQL test DB) :
- `upsertProfile` crée le bon nombre de `FitnessDayProgress` (durationWeeks × 7).
- `addWeightLog` / `addWorkoutSession` persistent + remontent dans `getFitnessData`.
- `toggleDayProgress` flip le flag `done`.
- **Isolation tenant** : un membre d'un tenant ne voit jamais les données d'un autre.
- Rollback de la transaction `upsertProfile` si échec milieu de boucle.

## Hors scope (YAGNI)

- Visibilité manager sur la progression des membres (itération future).
- Édition/suppression des pesées et séances (append-only pour l'instant).
- Notifications push fitness.

## Risques

- **Migration localStorage** : données de test surtout — perte acceptable, best-effort.
- **Refactor web** : risque de régression sur les tabs existants → l'interface `useFitApp` inchangée limite la surface.
- **Timers RN en arrière-plan** : `setInterval` se fige si l'app passe en background — acceptable (l'utilisateur garde l'écran ouvert pendant la séance), comportement identique au web.
