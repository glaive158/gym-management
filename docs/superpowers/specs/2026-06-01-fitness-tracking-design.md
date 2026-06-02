# Fitness Tracking — Design Spec

**Date** : 2026-06-01  
**Statut** : Approuvé  
**Branche** : feat/saas-billing

---

## Vue d'ensemble

Module de suivi santé et performance sportive intégré à l'espace membre (`/me/fitness`). Chaque membre configure son propre programme (objectif, durée, poids cible) et suit sa progression (séances, mensurations, photos). Les programmes d'exercices sont gérés par le manager par salle ; les membres peuvent aussi créer leurs propres programmes privés. Les données de progression restent privées (localStorage côté membre).

---

## Architecture

### Périmètre

| Couche | Technologie |
|--------|-------------|
| Programmes d'exercices | PostgreSQL via Prisma (multi-tenant, scoped par gym) |
| Données progression membre | `localStorage` clé `fitapp_v3` (privées, hors DB) |
| UI membre | Next.js App Router `/me/fitness` + composant React autonome |
| UI manager | `/manager/fitness` — CRUD programmes d'exercices |
| API | `/api/me/fitness/*` + `/api/manager/fitness/*` |
| Auth | NextAuth (web) — JWT bearer (mobile phase 2) |

### Isolation multi-tenant

Tous les modèles DB portent `tenantId` + `gymId`. La Prisma extension existante filtre automatiquement par tenant. Les membres ne voient que les programmes de leur salle (`gymId`).

---

## Modèles de données

### Nouveaux modèles Prisma

```prisma
enum FitnessProgramType {
  FULL_BODY
  GAINAGE_ABDOS
  JAMBES_FESSIERS
  HAUT_CORPS
  CUSTOM
}

model FitnessProgram {
  id            String              @id @default(cuid())
  tenantId      String
  gymId         String
  createdById   String?             // null = programme salle (manager) | userId = programme privé membre
  name          String
  color         String              @default("#C8FF00")
  type          FitnessProgramType  @default(CUSTOM)
  isActive      Boolean             @default(true)
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt

  tenant        Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  gym           Gym                 @relation(fields: [gymId], references: [id], onDelete: Cascade)
  createdBy     User?               @relation("MemberPrograms", fields: [createdById], references: [id], onDelete: SetNull)
  exercises     FitnessExercise[]

  @@index([tenantId])
  @@index([gymId])
  @@index([createdById])
}

model FitnessExercise {
  id              String          @id @default(cuid())
  programId       String
  tenantId        String
  name            String
  sets            Int
  repsOrDurationSec Int           // reps si < 100, secondes si >= 100 (convention)
  recoverySec     Int             @default(60)
  muscles         String          // ex: "Quadriceps, Fessiers"
  steps           Json            // String[] — étapes d'exécution
  tip             String?
  order           Int             @default(0)
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  program         FitnessProgram  @relation(fields: [programId], references: [id], onDelete: Cascade)
  tenant          Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([programId])
  @@index([tenantId])
}
```

### Schéma localStorage `fitapp_v3`

```ts
interface FitAppData {
  profile: {
    startWeightKg: number;
    goalWeightKg: number;
    durationWeeks: 4 | 8 | 12;
    startDate: string;       // ISO date
  } | null;
  currentWeek: number;       // 1-based
  weekData: WeekDay[][];     // [week][day] — 0=lundi … 6=dimanche
  weights: WeightEntry[];
  sleeps: SleepEntry[];
  sessions: SessionEntry[];
}

interface WeekDay {
  done: boolean;
  type: 'course' | 'fractional' | 'muscu' | 'marche' | 'yoga' | 'repos';
}

interface WeightEntry {
  date: string;
  weightKg: number;
}

interface SleepEntry {
  date: string;
  hours: number;
}

interface SessionEntry {
  date: string;
  programId: string;      // DB program id
  programName: string;
  durationMin: number;
}
```

---

## Routing

### Web

```
/me/fitness                    → Dashboard (home tab)
/me/fitness                    → composant gérant 5 onglets via état interne
/manager/fitness               → CRUD programmes d'exercices
/manager/fitness/new           → Créer programme
/manager/fitness/[id]          → Éditer programme + exercices
```

### API membre

```
GET  /api/me/fitness/programs                          → programmes salle + programmes privés du membre
POST /api/me/fitness/programs                          → créer programme privé
PUT  /api/me/fitness/programs/[id]                     → modifier son programme (ownership check)
DELETE /api/me/fitness/programs/[id]                   → supprimer son programme
POST /api/me/fitness/programs/[id]/exercises           → ajouter exercice
PUT  /api/me/fitness/programs/[id]/exercises/[eid]     → modifier exercice
DELETE /api/me/fitness/programs/[id]/exercises/[eid]   → supprimer exercice
```

### API manager

```
GET    /api/manager/fitness/programs                   → lister programmes de la salle
POST   /api/manager/fitness/programs                   → créer programme salle
PUT    /api/manager/fitness/programs/[id]              → modifier
DELETE /api/manager/fitness/programs/[id]              → supprimer
POST   /api/manager/fitness/programs/[id]/exercises    → ajouter exercice
PUT    /api/manager/fitness/programs/[id]/exercises/[eid]
DELETE /api/manager/fitness/programs/[id]/exercises/[eid]
```

---

## Interface membre `/me/fitness`

5 onglets via état interne React (pas de sous-routes) :

### Tab 1 — Accueil
- Header : semaine actuelle X/N + poids actuel (depuis localStorage)
- Barre progression : poids départ → poids cible semaine en cours (calculé linéairement)
- Carte "Aujourd'hui" : type d'entraînement + bouton action direct
- Grille 7 jours (L M M J V S D) avec icônes et statut fait/pas fait
- 4 accès rapides : Marche Japonaise, Circuit Abdos, Peser & Suivre, Programme

### Tab 2 — Marche Japonaise (Timer)
- Timer circulaire SVG animé (`stroke-dashoffset` transition 0.5s)
- Cycles : 2 min @ 6 km/h → 3 min @ 8 km/h → repeat, total 30 min
- Affichage : phase (MARCHE/RAPIDE), vitesse, temps restant phase, temps total, cycles, kcal (8.5 kcal/min)
- Boutons : Démarrer / Pause / Recommencer
- Écran fin : récap + bouton enregistrer (→ localStorage sessions)

### Tab 3 — Programme 8 Semaines
- Sélecteur semaine horizontal scrollable (S1 à SN selon durée choisie)
- Chaque semaine : objectif poids (calculé) + calories/jour cibles
- 7 jours cliquables : icône sport, type, durée, détail, checkbox fait/pas fait
- Distribution hebdomadaire fixe (voir données ci-dessous)

### Tab 4 — Renforcement Musculaire
- Section "Programmes de ta salle" (créés manager, read-only)
- Section "Mes programmes" (créés membre) + bouton "Créer un programme"
- Programmes chargés via `GET /api/me/fitness/programs`
- Clic programme → mode séance active (overlay)

**Mode séance active :**
- Barre progression exercices (points)
- Exercices chronométrés : timer circulaire SVG animé
- Exercices en reps : grand compteur + points de suivi par série
- Timer récupération SVG circulaire orange entre séries
- Boutons contextuels : Démarrer / C'est parti / Série faite → Récup / Passer / Exercice suivant
- Fin séance : stats + sauvegarde localStorage

### Tab 5 — Suivi Poids
- Grand poids actuel centré
- Stats : kg perdus (vert) / kg restants (orange)
- Graphique barres verticales SVG natif — 14 dernières pesées
- Formulaire : poids (step 0.1) + sommeil (step 0.5) + date
- Historique 5 dernières entrées

---

## Interface manager `/manager/fitness`

- Liste des programmes de la salle avec couleur, type, nb exercices
- Bouton "Nouveau programme" → form : nom, couleur, type
- Par programme : liste exercices ordonnés (drag-and-drop optionnel phase 2)
- CRUD exercice : nom, sets, reps/durée, récupération, muscles, steps (textarea JSON ou champs dynamiques), conseil
- Seed automatique des 4 programmes par défaut à la création d'une nouvelle salle

---

## Données programme 8 semaines

Cibles calculées dynamiquement selon poids départ/objectif/durée :

```ts
// Interpolation linéaire
weekTargetWeight = startWeight - (startWeight - goalWeight) * (week / totalWeeks)

// Calories cibles par semaine (ratio fixe)
weekCalories = basedOnWeek(week, totalWeeks) // voir tableau ci-dessous
```

Distribution jours (répétée chaque semaine) :

| Jour | Type | Icône | Durée |
|------|------|-------|-------|
| Lundi | Muscu (Full Body) | 💪 | 40 min |
| Mardi | Marche Japonaise | 🚶 | 30 min |
| Mercredi | Muscu (Gainage) | 💪 | 35 min |
| Jeudi | Repos | 😴 | — |
| Vendredi | Muscu (Jambes) | 💪 | 40 min |
| Samedi | Course | 🏃 | 30 min |
| Dimanche | Yoga / Étirements | 🧘 | 20 min |

---

## Données seed — 4 programmes par défaut

### Full Body `#C8FF00`
Squat · Pompes · Fentes alternées · Rowing sous table · Pike Push-up · Planche frontale 45s

### Gainage & Abdos `#FF6B35`
Planche frontale 45s · Planche latérale 30s · Crunch Bicycle · Mountain Climbers 30s · Dead Bug · Relevés de jambes

### Jambes & Fessiers `#4FC3F7`
Squat bulgare · Hip Thrust · Fente latérale · Soulevé roumain · Élévations de mollets · Planche latérale dynamique

### Haut du Corps `#CE93D8`
Pompes larges · Dips aux chaises · Curl bouteilles d'eau · Rowing sous table · Cercles de bras lestés · Superman

---

## Règles métier

- Un membre ne peut avoir qu'un programme actif par type à la fois (changer = désactiver l'ancien)
- `FitnessProgram.createdById = null` → programme salle, visible tous membres, modifiable manager uniquement
- `FitnessProgram.createdById = userId` → programme privé, visible + modifiable membre uniquement
- Ownership check sur PUT/DELETE programmes membres côté API
- Semaine courante = `Math.floor((now - startDate) / 7) + 1`, plafonnée à durée totale
- Calories marche : 8.5 kcal/min (fixe)
- Onboarding : si `fitapp_v3.profile === null` → modal de configuration au premier accès

---

## Composants nouveaux

```
src/
  app/
    me/fitness/
      page.tsx                          → wrapper page (session check + gymId)
    manager/fitness/
      page.tsx                          → liste programmes
      new/page.tsx                      → créer programme
      [id]/page.tsx                     → éditer programme + exercices
    api/
      me/fitness/
        programs/route.ts               → GET, POST
        programs/[id]/route.ts          → PUT, DELETE
        programs/[id]/exercises/route.ts
        programs/[id]/exercises/[eid]/route.ts
      manager/fitness/
        programs/route.ts
        programs/[id]/route.ts
        programs/[id]/exercises/route.ts
        programs/[id]/exercises/[eid]/route.ts
  components/
    member/
      fitness-tracker.tsx               → composant principal (5 onglets)
    manager/
      fitness-program-form.tsx
      fitness-exercise-form.tsx
  lib/
    fitness-seed.ts                     → seed 4 programmes par défaut
```

---

## Contraintes techniques

- Zéro dépendance externe (pas recharts, pas lucide) — SVG natif, CSS Tailwind
- Tous les timers : `stroke-dashoffset` CSS transition 0.5s
- Tous les écrans scrollables indépendamment
- `fitapp_v3` parsé/sauvegardé dans un hook `useFitApp()` custom
- Navigation bottom (5 onglets) : indicateur actif `#C8FF00` trait haut bouton
- Transitions `border-color` au hover sur cartes

---

## Tests

- Unit : calcul semaine courante, interpolation poids cible, kcal marche
- API : ownership check programmes membres, isolation tenant, seed programmes
- E2E : onboarding → config profil → log séance → suivi poids (Playwright, phase 2)

---

## Hors scope (phase 2)

- Sync localStorage → DB pour historique cross-device
- Vue manager stats membres
- App mobile Android (nouveaux screens)
- Drag-and-drop réordonnancement exercices
- Plans nutritionnels détaillés
