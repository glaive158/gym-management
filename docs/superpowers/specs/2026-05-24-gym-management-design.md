# Plateforme de gestion de salle de sport — Design Spec

**Date** : 2026-05-24
**Statut** : Design validé, en attente de plan d'implémentation

## Objectif

Plateforme moderne pour gérer une chaîne de salles de sport au Sénégal, avec gestion des abonnements, paiements (en ligne + physiques), et système de check-in par QR code à l'entrée des salles.

## Scope

### Inclus
- Gestion multi-salles (franchise/chaîne)
- 3 rôles : Super Admin, Manager (gérant de salle), Membre
- Gestion membres (CRUD, photo, contacts)
- Abonnements (formules, durées, expirations, renouvellements)
- Paiements en ligne (Wave, Orange Money, PayDunya) + enregistrement manuel cash/TPE
- Check-in QR code à l'entrée avec validation temps réel
- Dashboard gérant temps réel (vert = à jour, rouge = expiré)
- Anti-fraude : géolocalisation + validation photo membre
- Notifications expiration (email/SMS/WhatsApp)
- Rapports (revenus, présences, rétention)

### Exclus (hors scope MVP)
- Planning de cours collectifs
- Réservation de coachs
- Suivi physique/santé membre (poids, mensurations)
- App mobile native (PWA suffit pour MVP)

## Stack technique

| Couche | Choix | Justification |
|--------|-------|---------------|
| Framework | Next.js 14 (App Router) + TypeScript | Fullstack, monorepo, déploiement simple |
| UI | shadcn/ui + Tailwind CSS | Moderne, composants accessibles |
| Database | PostgreSQL | Relationnel robuste, multi-tenant |
| ORM | Prisma | Type-safe, migrations propres |
| Auth | NextAuth.js | 3 rôles, middleware route protection |
| Paiement | Wave + Orange Money + PayDunya | Passerelles disponibles au Sénégal |
| Temps réel | Pusher (ou Soketi self-hosted) | WebSocket simple pour dashboard live |
| PWA | next-pwa | Membre installe sur téléphone sans app store |
| QR | qrcode + html5-qrcode | Génération + scan via camera mobile |
| Notifications | Resend (email) + WhatsApp Business API | Coût raisonnable, adoption locale forte |

## Architecture

### Modules

1. **Auth & Rôles** — NextAuth, middleware Next.js, 3 rôles isolés
2. **Gestion Membres** — CRUD complet, photo obligatoire (anti-fraude)
3. **Abonnements** — formules par salle, calcul auto expiration
4. **Paiements** — Stripe-like flow avec adapters Wave/OM/PayDunya + saisie manuelle
5. **QR Check-in** — QR statique par salle, scan mobile membre, validation backend, événement Pusher
6. **Dashboard Gérant** — vue temps réel des entrées, photo membre affichée en grand
7. **Multi-salles** — Super Admin global, Manager scopé à sa salle
8. **Notifications** — alertes J-7, J-3, J-0 expiration
9. **Rapports** — revenus période, présences, taux rétention, export CSV/PDF

### Flow QR Check-in

```
1. QR statique imprimé/affiché à l'entrée de la salle
   └─ Encode : https://app.com/checkin?gym={GYM_TOKEN}

2. Membre scanne avec son téléphone
   └─ Si pas connecté → redirige login → retour checkin

3. Page checkin demande géolocalisation
   └─ Vérifie distance < 100m de la salle
   └─ Si trop loin → refus "Vous devez être à la salle"

4. Backend valide
   ├─ Abonnement actif ? → status VALID
   ├─ Abonnement expiré ? → status EXPIRED
   └─ Crée enregistrement CheckIn

5. Événement Pusher → Dashboard gérant
   ├─ Photo membre affichée en grand
   ├─ Badge vert (à jour) ou rouge (expiré)
   └─ Gérant valide visuellement (photo = personne devant lui)

6. Membre voit confirmation sur son écran
   ├─ ✅ Bienvenue + date expiration (si à jour)
   └─ ⛔ Renouveler (si expiré) → lien paiement direct
```

### Anti-fraude

- **Géolocalisation obligatoire** au scan (rayon 100m autour de la salle)
- **Photo membre stockée** dans profil, affichée en grand sur dashboard gérant
- **Gérant valide visuellement** chaque check-in (la photo doit correspondre à la personne)
- **Refus automatique** si géoloc hors zone ou refusée

## Modèle de données

### Entités

**Gym**
- id, name, address, city, phone, logo
- latitude, longitude (pour vérification géoloc)
- qr_token (unique, identifie la salle dans URL check-in)
- is_active, created_at

**User**
- id, name, email, phone, password_hash, avatar (obligatoire pour MEMBER)
- role : SUPER_ADMIN | MANAGER | MEMBER
- gym_id (FK → Gym, null pour SUPER_ADMIN)
- is_active, created_at

**Plan** (formule d'abonnement)
- id, name, duration_days (30/90/180/365)
- price, currency (XOF)
- gym_id (FK → Gym)
- is_active

**Subscription**
- id, member_id (FK → User), plan_id (FK → Plan)
- start_date, end_date
- status : ACTIVE | EXPIRED | CANCELLED | PENDING
- auto_renew (boolean)

**Payment**
- id, subscription_id (FK)
- amount, currency
- method : WAVE | ORANGE_MONEY | PAYDUNYA | CASH | TPE
- status : PAID | PENDING | FAILED
- external_payment_id (nullable, ID transaction passerelle)
- recorded_by (FK → User, pour paiements manuels)
- paid_at

**CheckIn**
- id, member_id (FK → User), gym_id (FK → Gym)
- scanned_at (timestamp)
- status : VALID | EXPIRED | NOT_FOUND | GEO_REJECTED
- subscription_id (FK, nullable)
- latitude, longitude (pour audit)

### Relations clés
- Gym → many Users (managers + membres)
- Gym → many Plans
- User (MEMBER) → many Subscriptions
- Subscription → many Payments
- Gym → many CheckIns
- User → many CheckIns

## Écrans clés

1. **Dashboard Gérant** — stats du jour, liste check-ins live avec photo + statut
2. **Page Check-in Membre** (mobile PWA) — confirmation visuelle après scan
3. **Liste Membres** — recherche, filtres, badges statut, actions rapides
4. **Détail Membre** — profil, historique abonnements, historique check-ins, historique paiements
5. **Gestion Formules** — CRUD plans par salle
6. **Saisie Paiement Manuel** — formulaire cash/TPE par le gérant
7. **Rapports** — graphiques revenus, taux rétention, export
8. **Super Admin** — vue globale toutes salles, agrégats

## Considérations techniques

### Sécurité
- Toutes les routes API protégées par middleware Next.js
- Vérification rôle ET appartenance à la salle (manager ne voit que sa salle)
- Tokens QR signés pour empêcher forge
- HTTPS obligatoire (PWA requirement)
- Photos stockées sur S3-compatible (MinIO/Backblaze)

### Mode offline / fallback
- Si Pusher down → dashboard fallback polling toutes les 5s
- Si membre ne peut pas scanner → gérant peut faire check-in manuel depuis dashboard

### Performance
- Index PostgreSQL sur : `user.email`, `user.gym_id`, `subscription.member_id`, `subscription.end_date`, `checkin.gym_id+scanned_at`
- Cron quotidien : marquer `Subscription.status = EXPIRED` à minuit
- Cron quotidien : envoyer notifications J-7, J-3, J-0

### Tests
- Tests unitaires : logique métier abonnements, calculs expiration
- Tests intégration : flow check-in complet (scan → validation → event)
- Tests E2E Playwright : parcours critiques (inscription membre, paiement, check-in)

## Décisions clés validées

- **Pays cible** : Sénégal → passerelles Wave, Orange Money, PayDunya
- **Anti-fraude QR** : géolocalisation + photo membre
- **Architecture** : Next.js 14 fullstack monorepo
- **Multi-rôles** : Super Admin + Manager + Membre
- **Multi-salles** : oui dès MVP (architecture pensée pour franchise)

## Risques connus

- **Coût notifications SMS** → WhatsApp Business API préféré
- **Stripe indispo localement** → adaptateurs paiement à coder pour Wave/OM/PayDunya
- **Précision GPS en intérieur** → rayon 100m généreux pour éviter faux négatifs
- **Connexion internet salle** → fallback polling + check-in manuel par gérant
