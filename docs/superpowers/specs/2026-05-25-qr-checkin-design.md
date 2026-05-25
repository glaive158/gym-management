# QR Check-in + Temps réel + Anti-fraude — Design

**Date** : 2026-05-25
**Plan** : 5
**Statut** : design approuvé, prêt pour writing-plans

## Objectif

Permettre aux membres de salles de sport de pointer leur entrée via QR code scanné depuis leur téléphone. Validation backend (abonnement actif + géolocalisation < 100m de la salle). Dashboard manager temps réel affiche check-ins avec photo membre pour vérification visuelle anti-fraude. Fallback manuel si connexion coupe ou GPS échoue.

## Décisions architecturales validées

| Décision | Choix | Raison |
|----------|-------|--------|
| Techno temps réel | **Pusher** (SaaS) | MVP rapide, palier gratuit 200k msg/jour, bascule Soketi possible plus tard (même protocole) |
| Flux validation | **Confirmation auto** si tout OK | Pas de file d'attente entrée, gérant voit en passif. Anti-fraude assurée par photo + géoloc |
| Délai anti-doublon | **1 check-in VALIDE / membre / jour** | Évite re-scans abusifs, autorise sortie/retour sans erreur (réponse "Déjà enregistré") |
| Repli hors-ligne | **Page gérant check-in manuel** | Cahier des charges l'indique. Gérant cherche membre par nom/téléphone et enregistre source: MANUEL |

## Flux QR check-in

```
QR statique imprimé entrée salle → URL: app.com/checkin?gym={qrToken}
   │
   ├─ Non connecté → /login → retour /checkin (paramètres préservés)
   │
Page /checkin (composant client) :
   1. Demande géolocalisation navigateur via navigator.geolocation.getCurrentPosition
   2. POST /api/checkin { qrToken, lat, lng }
   3. Affiche résultat selon statut retourné
   │
Backend /api/checkin (auth : tout MEMBRE) :
   1. Recherche salle par qrToken (lookup inter-tenant car qrToken unique global)
   2. Vérifie member.tenantId === gym.tenantId (défense en profondeur)
   3. distance = haversine(membre, salle) ; si > 100m → GEO_REJECTED (enregistré, pas de Pusher)
   4. Anti-doublon : cherche CheckIn même membre/jour avec statut VALIDE → si trouvé, DUPLICATE
   5. Vérification abonnement : aucun actif → NO_SUBSCRIPTION ; expiré → EXPIRED
   6. Insertion CheckIn (statut, distanceMeters, lat, lng, source : QR)
   7. Déclenchement Pusher sur `private-gym-{gymId}` (sauf pour GEO_REJECTED)
   8. Retourne { statut, memberName?, expiresAt? }
   │
Tableau de bord /manager/checkin-live (serveur + client) :
   - Serveur fetch : derniers 50 check-ins du jour
   - Client : Pusher subscribe `private-gym-{gymId}` → ajoute nouveaux check-ins en tête
   - Carte affichée : photo en grand, nom, badge statut (vert/jaune/rouge), heure
   - Bouton "Check-in manuel" (toujours visible, repli)
```

## Anti-fraude

1. **Géofence 100m** — haversine côté serveur, GPS navigateur côté client
2. **Correspondance tenant** — member.tenantId === gym.tenantId (même si qrToken connu d'un autre tenant)
3. **Anti-doublon 1/jour** — empêche partage de scan entre membres
4. **Photo obligatoire** — Plan 3 l'impose, affichée en grand au gérant pour vérification visuelle
5. **Piste d'audit** — TOUS les CheckIn enregistrés (même rejetés) pour analyse forensique
6. **Canal privé Pusher** — endpoint `/api/pusher/auth` valide `role === MANAGER && gymId correspond`

## Modèle de données

```prisma
enum CheckInStatus {
  VALID
  EXPIRED
  GEO_REJECTED
  DUPLICATE
  NO_SUBSCRIPTION
}

model CheckIn {
  id             String         @id @default(cuid())
  tenantId       String
  gymId          String
  memberId       String
  subscriptionId String?
  status         CheckInStatus
  latitude       Float?
  longitude      Float?
  distanceMeters Int?
  source         String         @default("QR")  // QR | MANUAL
  createdAt      DateTime       @default(now())

  tenant       Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  gym          Gym           @relation(fields: [gymId], references: [id], onDelete: Cascade)
  member       User          @relation("MemberCheckIns", fields: [memberId], references: [id], onDelete: Cascade)
  subscription Subscription? @relation(fields: [subscriptionId], references: [id], onDelete: SetNull)

  @@index([tenantId])
  @@index([gymId, createdAt])
  @@index([memberId, createdAt])
}
```

Back-relations sur Tenant, Gym, User (`@relation("MemberCheckIns")`), Subscription.
Ajouter `"CheckIn"` à `TENANT_SCOPED_MODELS`.

## Fichiers à créer

| Fichier | Responsabilité |
|---------|---------------|
| `src/lib/geo.ts` | `haversineMeters(lat1, lng1, lat2, lng2)` — calcul de distance |
| `src/lib/pusher-server.ts` | Singleton Pusher serveur + helper `pusherTrigger()`, no-op si env absent |
| `src/lib/pusher-client.ts` | Singleton Pusher client + `subscribeToGym(gymId, onEvent)` |
| `src/lib/server-actions/checkin.ts` | `performCheckIn`, `manualCheckIn`, `listRecentCheckIns` |
| `src/app/checkin/page.tsx` | Composant serveur check-in mobile (vérif auth + rendu client) |
| `src/app/checkin/checkin-client.tsx` | Composant client géoloc + fetch /api/checkin + UI résultats |
| `src/app/api/checkin/route.ts` | Endpoint POST MEMBRE |
| `src/app/api/manager/checkin/route.ts` | Endpoint POST MANAGER (check-in manuel) |
| `src/app/api/pusher/auth/route.ts` | Authentification canal privé Pusher |
| `src/app/manager/checkin-live/page.tsx` | Tableau de bord temps réel (fetch serveur initial 50) |
| `src/app/manager/checkin-live/live-feed.tsx` | Composant client Pusher subscribe + liste d'état |
| `src/components/manager/manual-checkin.tsx` | Modale recherche membre + soumission manuelle |
| `src/components/manager/checkin-card.tsx` | Carte affichage (photo + nom + badge statut) |
| `tests/lib/geo.test.ts` | Tests haversine |
| `tests/lib/server-actions/checkin.test.ts` | ~12 tests CRUD + anti-fraude |

## Fichiers à modifier

| Fichier | Modification |
|---------|-------|
| `prisma/schema.prisma` | Ajout CheckIn + CheckInStatus + relations inverses |
| `prisma/migrations/...` | Auto-générée `add_checkin_model` |
| `src/lib/prisma-tenant.ts` | Ajout `"CheckIn"` à TENANT_SCOPED_MODELS |
| `tests/helpers/db.ts` | `checkIn.deleteMany()` en tête de resetDb |
| `src/components/manager/nav.tsx` | Lien "Check-ins live" |
| `src/app/manager/page.tsx` | Stat "Présences aujourd'hui" (5e carte ou remplace) |

## Environnement

```env
# .env.local
PUSHER_APP_ID=
PUSHER_KEY=
PUSHER_SECRET=
PUSHER_CLUSTER=eu
NEXT_PUBLIC_PUSHER_KEY=
NEXT_PUBLIC_PUSHER_CLUSTER=eu
```

Configuration Pusher à effectuer manuellement par l'utilisateur (création app sur dashboard.pusher.com). En dev/test sans identifiants → `pusherTrigger` est no-op (log console).

## Gestion erreurs côté client

| Cas | UI membre |
|-----|-----------|
| Géoloc refusée | "Activez la localisation puis réessayez" + bouton réessayer |
| Géoloc timeout 10s | "Position introuvable. Activez le GPS." |
| Erreur réseau | Spinner → toast d'erreur + réessayer |
| `INVALID_QR` | "QR invalide. Demandez à l'accueil." |
| `WRONG_TENANT` | "Ce QR n'est pas pour votre salle." |
| `GEO_REJECTED` | 🚫 "Vous êtes à {distance}m. Approchez de l'entrée." |
| `DUPLICATE` | ℹ️ "Déjà enregistré aujourd'hui à {time}" |
| `NO_SUBSCRIPTION` | ⛔ "Aucun abonnement actif" + contacter le gérant |
| `EXPIRED` | ⛔ "Abonnement expiré le {date}" + bouton "Renouveler" |
| `VALID` | ✅ "Bienvenue {name}. Valide jusqu'au {date}" |

## Charge utile Pusher

Canal : `private-gym-{gymId}`
Événement : `checkin`
Données :
```json
{
  "checkInId": "ckxxx",
  "memberId": "ckyyy",
  "memberName": "Fatou Diop",
  "memberAvatar": "/uploads/fatou.jpg",
  "status": "VALID",
  "createdAt": "2026-05-25T10:30:00Z",
  "expiresAt": "2026-06-15T00:00:00Z",
  "source": "QR"
}
```

## Tests

- Pusher mocké dans les tests (no-op si env absent) — vérification par spy
- Tests BD via `testPrisma` + `resetDb` (motif Plan 4)
- Géolocalisation navigateur non mockée en CI (couverte par tests manuels + Plan 8 mobile)

**Critères de complétion :**
- Migration de schéma appliquée et `npm test` passe (~101 tests, 75 + 10 Plan 4 + ~16 Plan 5)
- `npm run typecheck` 0 erreur
- Manuel : scan QR sur mobile réel → check-in en <2s sur tableau de bord gérant
- Repli check-in manuel opérationnel
- 4+ états d'erreur testés visuellement sur mobile

## Risques + mitigations

| Risque | Atténuation |
|--------|-----------|
| GPS imprécis intérieur béton | Rayon 100m généreux + repli manuel |
| Photo membre manquante | Déjà imposée par Plan 3 (avatar obligatoire) |
| Quota gratuit Pusher dépassé | Supervision, bascule Soketi en plan B (même protocole, swap simple) |
| Membre scanne QR d'une autre salle du même tenant | OK (tenants multi-salles) — gym.tenantId vérifié |
| Membre d'un autre tenant scanne le QR | Bloqué par vérif WRONG_TENANT |
| Rejeu de requête (replay attack) | Anti-doublon 1/jour ⇒ DUPLICATE rejette |
| Connexion salle coupée | UI de repli manuel toujours disponible |

## Hors périmètre (Plan 5)

- Application React Native (Plan 8)
- Notifications WhatsApp check-in (Plan 7)
- Statistiques temporelles (graphiques fréquentation par heure/jour) — UI tableau de bord simple uniquement
- Scanner iframe/embarqué — utilise parsing standard `window.location.search`
- Reconnaissance faciale photo (validation gérant reste manuelle et visuelle)
