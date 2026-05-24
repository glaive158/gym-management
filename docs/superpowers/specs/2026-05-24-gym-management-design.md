# Plateforme SaaS de gestion de salles de sport — Design Spec

**Date** : 2026-05-24
**Statut** : Design validé, en attente de plan d'implémentation
**Modèle** : SaaS multi-tenant

## Objectif

Plateforme SaaS moderne permettant à des propriétaires de salles de sport au Sénégal de gérer leurs salles, abonnements, paiements, et présences via check-in QR code. Chaque propriétaire = tenant isolé, peut gérer une ou plusieurs salles.

## Modèle SaaS

### Hiérarchie des rôles

| Rôle | Scope | Capacités |
|------|-------|-----------|
| **PLATFORM_OWNER** | Toute la plateforme | Valide nouveaux tenants, voit tous tenants, gère facturation SaaS (plus tard), suspend tenants |
| **TENANT_ADMIN** | Une organisation (= 1 propriétaire) | Crée/gère ses salles, ajoute managers, voit stats de toutes ses salles |
| **MANAGER** | Une salle d'un tenant | Gère membres, paiements, dashboard check-in temps réel de SA salle |
| **MEMBER** | Soi-même | Profil, abonnement, scan QR, historique perso |

### Isolation tenant
- Toute requête API filtrée par `tenant_id`
- Manager d'un tenant A ne peut jamais voir données du tenant B
- Membres scopés à un tenant (peuvent appartenir à une seule organisation)
- Vérification middleware Next.js sur chaque route

### Onboarding hybride
1. Propriétaire visite landing → s'inscrit librement (email, nom organisation, téléphone)
2. Compte créé avec `status = PENDING` — pas d'accès à l'app
3. PLATFORM_OWNER reçoit notification → valide ou rejette depuis son dashboard
4. Si validé → email au propriétaire avec lien activation → accès dashboard tenant
5. Première étape : créer sa première salle + ses formules d'abonnement

### Facturation
- **Beta** : gratuit pour tous tenants validés
- Modèle de facturation reporté après beta (flag `billing_plan = null` pendant beta)
- Spec billing à faire dans phase 2

## Scope MVP

### Inclus
- Multi-tenant SaaS avec isolation totale
- Onboarding hybride avec validation PLATFORM_OWNER
- Dashboard PLATFORM_OWNER (validation tenants, vue globale, suspension)
- Dashboard TENANT_ADMIN (multi-salles d'une organisation)
- Dashboard MANAGER (une salle, temps réel)
- Espace MEMBER (mobile PWA)
- Gestion membres, abonnements, formules
- Paiements en ligne (Wave, Orange Money, PayDunya) + manuel (cash, TPE)
- Check-in QR avec géoloc + photo anti-fraude
- Notifications expiration (email + WhatsApp)
- Rapports par salle et globaux (TENANT_ADMIN)

### Exclus (hors MVP)
- Facturation SaaS (phase 2)
- Planning cours collectifs
- Coaching / réservations
- App mobile native
- White-label / domaines personnalisés par tenant
- Suivi physique membres

## Stack technique

| Couche | Choix | Justification |
|--------|-------|---------------|
| Framework | Next.js 14 (App Router) + TypeScript | Fullstack, monorepo, déploiement simple |
| UI | shadcn/ui + Tailwind CSS | Moderne, composants accessibles |
| Database | PostgreSQL | Relationnel robuste, multi-tenant via tenant_id |
| ORM | Prisma | Type-safe, migrations propres, middleware tenant scope |
| Auth | NextAuth.js | 4 rôles, middleware Next.js |
| Paiement | Wave + Orange Money + PayDunya | Passerelles disponibles au Sénégal |
| Temps réel | Pusher (ou Soketi self-hosted) | WebSocket pour dashboard live, channels par tenant |
| PWA | next-pwa | Membre installe sur téléphone sans app store |
| QR | qrcode + html5-qrcode | Génération + scan camera mobile |
| Email | Resend | Notifications, validation onboarding |
| WhatsApp | WhatsApp Business API | Alertes expiration (adoption locale forte) |
| Storage | S3-compatible (MinIO/Backblaze) | Photos membres, logos |

## Architecture

### Routing (URL structure)

```
app.com/                          → Landing publique
app.com/signup                    → Inscription propriétaire
app.com/login                     → Login (tous rôles)
app.com/platform                  → Dashboard PLATFORM_OWNER
app.com/platform/tenants          → Liste tenants (validation)
app.com/admin                     → Dashboard TENANT_ADMIN
app.com/admin/gyms                → Gestion salles
app.com/admin/managers            → Gestion gérants
app.com/admin/reports             → Rapports tenant
app.com/manager                   → Dashboard MANAGER (sa salle)
app.com/manager/members           → Membres
app.com/manager/payments          → Paiements
app.com/me                        → Espace membre
app.com/checkin?gym={token}       → Page check-in (membre scanne)
```

### Modules

1. **Multi-tenant Core** — middleware d'isolation, contexte tenant dans chaque requête
2. **Auth & Rôles** — NextAuth, 4 rôles, vérification scope tenant
3. **Tenant Management** — onboarding, validation par PLATFORM_OWNER, suspension
4. **Gestion Salles** — CRUD salles par tenant
5. **Gestion Gérants** — TENANT_ADMIN ajoute MANAGERs et les assigne à salles
6. **Gestion Membres** — CRUD avec photo obligatoire (anti-fraude)
7. **Abonnements** — formules par salle, calcul auto expiration
8. **Paiements** — adapters Wave/OM/PayDunya + saisie manuelle
9. **QR Check-in** — QR statique par salle, scan mobile, validation backend, événement Pusher
10. **Dashboard temps réel** — vue live avec photo membre, scoped par rôle
11. **Notifications** — alertes expiration J-7, J-3, J-0
12. **Rapports** — agrégats par salle / par tenant

### Flow Onboarding tenant

```
1. Visiteur → /signup
   ├─ Formulaire : nom organisation, nom propriétaire, email, téléphone, ville
   └─ Submit → crée Tenant {status: PENDING} + User {role: TENANT_ADMIN, status: PENDING}

2. PLATFORM_OWNER reçoit notif email + voit demande dans /platform/tenants

3. PLATFORM_OWNER valide ou rejette
   ├─ Valider → Tenant.status = ACTIVE, User.status = ACTIVE
   │   └─ Email au propriétaire avec lien set-password
   └─ Rejeter → Tenant.status = REJECTED + email avec raison

4. Propriétaire reçoit email → définit mot de passe → accède /admin
   └─ Wizard initial : créer 1ère salle + 1ère formule
```

### Flow QR Check-in

```
1. QR statique imprimé à l'entrée de la salle
   └─ Encode : https://app.com/checkin?gym={GYM_QR_TOKEN}

2. Membre scanne avec son téléphone
   └─ Si pas connecté → redirige login → retour checkin

3. Page checkin demande géolocalisation
   └─ Vérifie distance < 100m de la salle
   └─ Si trop loin → refus "Vous devez être à la salle"

4. Backend valide (vérifie aussi tenant_id correspond)
   ├─ Abonnement actif ? → status VALID
   ├─ Abonnement expiré ? → status EXPIRED
   └─ Crée enregistrement CheckIn

5. Événement Pusher (channel: tenant-{id}-gym-{id}) → Dashboard manager
   ├─ Photo membre affichée en grand
   ├─ Badge vert (à jour) ou rouge (expiré)
   └─ Gérant valide visuellement

6. Membre voit confirmation sur son écran
   ├─ ✅ Bienvenue + date expiration (si à jour)
   └─ ⛔ Renouveler (si expiré) → lien paiement direct
```

### Anti-fraude
- Géolocalisation obligatoire au scan (rayon 100m)
- Photo membre obligatoire dans profil
- Dashboard manager affiche photo en grand pour validation visuelle
- Refus auto si géoloc hors zone

## Modèle de données

### Entités

**Tenant** (organisation propriétaire)
- id, name, slug (unique, pour URLs futures)
- owner_email, owner_phone, city
- status : PENDING | ACTIVE | SUSPENDED | REJECTED
- billing_plan (nullable, beta = null)
- validated_at, validated_by (FK → User PLATFORM_OWNER)
- rejection_reason (nullable)
- created_at

**User**
- id, name, email, phone, password_hash, avatar
- role : PLATFORM_OWNER | TENANT_ADMIN | MANAGER | MEMBER
- tenant_id (FK → Tenant, null pour PLATFORM_OWNER)
- gym_id (FK → Gym, null pour TENANT_ADMIN et MEMBER, requis pour MANAGER)
- status : PENDING | ACTIVE | SUSPENDED
- avatar (obligatoire pour MEMBER)
- is_active, created_at

**Gym** (salle)
- id, tenant_id (FK → Tenant)
- name, address, city, phone, logo
- latitude, longitude (pour vérification géoloc)
- qr_token (unique, identifie la salle dans URL check-in)
- is_active, created_at

**Plan** (formule d'abonnement)
- id, tenant_id (FK → Tenant), gym_id (FK → Gym)
- name, duration_days (30/90/180/365)
- price, currency (XOF)
- is_active

**Subscription**
- id, tenant_id (FK), member_id (FK → User), plan_id (FK → Plan)
- start_date, end_date
- status : ACTIVE | EXPIRED | CANCELLED | PENDING
- auto_renew (boolean)

**Payment**
- id, tenant_id (FK), subscription_id (FK)
- amount, currency
- method : WAVE | ORANGE_MONEY | PAYDUNYA | CASH | TPE
- status : PAID | PENDING | FAILED
- external_payment_id (nullable)
- recorded_by (FK → User)
- paid_at

**CheckIn**
- id, tenant_id (FK), member_id (FK → User), gym_id (FK → Gym)
- scanned_at (timestamp)
- status : VALID | EXPIRED | NOT_FOUND | GEO_REJECTED
- subscription_id (FK, nullable)
- latitude, longitude (audit)

### Relations clés
- Tenant → many Users, Gyms, Plans, Subscriptions, Payments, CheckIns
- Gym → many Users (managers), Plans, CheckIns
- User (MEMBER) → many Subscriptions, CheckIns
- Subscription → many Payments

### Règle d'isolation (Prisma middleware)
Chaque query (sauf PLATFORM_OWNER context) doit automatiquement injecter `WHERE tenant_id = currentTenantId`. Middleware Prisma global pour garantir l'isolation, jamais bypass.

## Écrans clés

### PLATFORM_OWNER
- Dashboard global (nb tenants actifs, en attente, suspendus, stats agrégées)
- Liste tenants avec actions (valider, rejeter, suspendre)
- Détail tenant (info, salles, managers, activité)

### TENANT_ADMIN
- Dashboard organisation (toutes mes salles, stats agrégées)
- Gestion salles (CRUD)
- Gestion managers (créer, assigner à salle)
- Rapports tenant (revenus toutes salles, classement salles)

### MANAGER
- Dashboard salle temps réel (check-ins live avec photo)
- Liste membres avec recherche/filtres
- Détail membre (profil, abonnements, paiements, présences)
- Gestion formules de la salle
- Saisie paiement manuel
- Rapports salle

### MEMBER (PWA mobile)
- Profil + photo
- Abonnement actuel + date expiration
- Bouton renouveler (lien paiement)
- Historique présences
- Page check-in après scan QR (✅ bienvenue ou ⛔ expiré)

## Considérations techniques

### Sécurité
- Middleware Next.js valide rôle + scope tenant sur chaque route protégée
- Prisma middleware global injecte filtre `tenant_id` (zero-trust)
- Tokens QR signés HMAC pour empêcher forge
- HTTPS obligatoire
- Photos stockées avec ACL privé, servies via URLs signées
- Rate limiting sur endpoints publics (signup, checkin)

### Mode offline / fallback
- Si Pusher down → dashboard fallback polling 5s
- Si membre ne peut pas scanner → manager fait check-in manuel depuis dashboard
- Si géoloc refusée → manager peut override avec justification (loggé)

### Performance
- Index PostgreSQL composites :
  - `(tenant_id, status)` sur tenants
  - `(tenant_id, gym_id, scanned_at)` sur checkins
  - `(tenant_id, end_date, status)` sur subscriptions
- Cron quotidien : marquer Subscriptions `EXPIRED` à minuit
- Cron quotidien : notifications J-7, J-3, J-0
- Pusher channels scopés tenant : `tenant-{id}-gym-{id}-checkins`

### Tests
- Tests unitaires : logique abonnements, calculs expiration, validation géoloc
- Tests intégration : flow check-in complet, isolation tenant (assert qu'un tenant ne voit jamais données d'un autre)
- Tests E2E Playwright : onboarding tenant, paiement, check-in

## Décisions clés validées

- **Modèle** : SaaS multi-tenant
- **Pays cible** : Sénégal → Wave, Orange Money, PayDunya
- **Anti-fraude QR** : géolocalisation + photo membre
- **Architecture** : Next.js 14 fullstack monorepo
- **4 rôles** : PLATFORM_OWNER, TENANT_ADMIN, MANAGER, MEMBER
- **Onboarding** : hybride (sign-up libre + validation PLATFORM_OWNER)
- **Facturation** : gratuit pendant beta, modèle à définir phase 2

## Risques connus

- **Isolation tenant** → bug = leak de données entre organisations. Tests d'isolation obligatoires
- **Coût SMS** → WhatsApp Business API préféré
- **Stripe indispo** → adaptateurs Wave/OM/PayDunya à coder
- **Précision GPS intérieur** → rayon 100m généreux
- **Connexion salle** → fallback polling + check-in manuel

## Phases

- **Phase 1 (MVP)** : tout le scope ci-dessus, beta gratuite
- **Phase 2** : facturation SaaS, white-label optionnel, planning cours
