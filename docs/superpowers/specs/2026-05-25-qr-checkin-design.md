# QR Check-in + Temps réel + Anti-fraude — Design

**Date** : 2026-05-25
**Plan** : 5
**Statut** : design approuvé, prêt pour writing-plans

## Objectif

Permettre aux membres de salles de sport de pointer leur entrée via QR code scanné depuis leur téléphone. Validation backend (abonnement actif + géolocalisation < 100m de la salle). Dashboard manager temps réel affiche check-ins avec photo membre pour vérification visuelle anti-fraude. Fallback manuel si connexion coupe ou GPS échoue.

## Décisions architecturales validées

| Décision | Choix | Raison |
|----------|-------|--------|
| Techno temps réel | **Pusher** (SaaS) | MVP rapide, free tier 200k msg/jour, swap Soketi possible plus tard (même protocole) |
| Flow validation | **Auto-confirm** si tout OK | Pas de file d'attente entrée, manager voit en passif. Anti-fraude assurée par photo + géoloc |
| Cooldown | **1 check-in VALID / membre / jour** | Évite re-scans abusifs, autorise sortie/retour sans erreur (réponse "Déjà enregistré") |
| Fallback offline | **Page manager check-in manuel** | Spec mentionne. Manager cherche membre par nom/téléphone et enregistre source: MANUAL |

## Flow QR check-in

```
QR statique imprimé entrée salle → URL: app.com/checkin?gym={qrToken}
   │
   ├─ Pas connecté → /login → retour /checkin (preserve query)
   │
Page /checkin (client component):
   1. Demande géoloc browser via navigator.geolocation.getCurrentPosition
   2. POST /api/checkin { qrToken, lat, lng }
   3. Affiche résultat selon status retourné
   │
Backend /api/checkin (auth: any MEMBER):
   1. Resolve gym par qrToken (lookup cross-tenant car qrToken unique global)
   2. Verify member.tenantId === gym.tenantId (defense-in-depth)
   3. distance = haversine(member, gym); si > 100m → GEO_REJECTED (enregistré, pas de Pusher)
   4. Cooldown: cherche CheckIn même membre/jour avec status VALID → si trouvé, DUPLICATE
   5. Subscription check: pas d'actif → NO_SUBSCRIPTION; expiré → EXPIRED
   6. Insert CheckIn (status, distanceMeters, lat, lng, source: QR)
   7. Pusher trigger sur `private-gym-{gymId}` (sauf pour GEO_REJECTED)
   8. Return { status, memberName?, expiresAt? }
   │
Dashboard /manager/checkin-live (server + client):
   - Server fetch: derniers 50 check-ins du jour
   - Client: Pusher subscribe `private-gym-{gymId}` → prepend nouveaux check-ins
   - Card affichage: photo grande, nom, badge status (vert/jaune/rouge), heure
   - Bouton "Check-in manuel" (toujours visible, fallback)
```

## Anti-fraude

1. **Géofence 100m** — haversine côté serveur, GPS browser côté client
2. **Tenant match** — member.tenantId === gym.tenantId (même si qrToken connu d'un autre tenant)
3. **Cooldown 1/jour** — empêche scan partagé entre membres
4. **Photo obligatoire** — Plan 3 enforce, affichée grande au manager pour vérification visuelle
5. **Audit trail** — TOUS les CheckIn enregistrés (même rejetés) pour forensic
6. **Channel privé Pusher** — endpoint `/api/pusher/auth` valide `role === MANAGER && gymId match`

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
| `src/lib/geo.ts` | `haversineMeters(lat1, lng1, lat2, lng2)` — calcul distance |
| `src/lib/pusher-server.ts` | Pusher server singleton + `pusherTrigger()` helper, no-op si env absent |
| `src/lib/pusher-client.ts` | Pusher client singleton + `subscribeToGym(gymId, onEvent)` |
| `src/lib/server-actions/checkin.ts` | `performCheckIn`, `manualCheckIn`, `listRecentCheckIns` |
| `src/app/checkin/page.tsx` | Server component check-in mobile (auth check + render client) |
| `src/app/checkin/checkin-client.tsx` | Client geoloc + fetch /api/checkin + UI résultats |
| `src/app/api/checkin/route.ts` | POST endpoint MEMBER |
| `src/app/api/manager/checkin/route.ts` | POST endpoint MANAGER (check-in manuel) |
| `src/app/api/pusher/auth/route.ts` | Auth canal privé Pusher |
| `src/app/manager/checkin-live/page.tsx` | Dashboard live (server fetch initial 50) |
| `src/app/manager/checkin-live/live-feed.tsx` | Client Pusher subscribe + state list |
| `src/components/manager/manual-checkin.tsx` | Modal recherche membre + submit manual |
| `src/components/manager/checkin-card.tsx` | Carte affichage (photo + nom + badge status) |
| `tests/lib/geo.test.ts` | Tests haversine |
| `tests/lib/server-actions/checkin.test.ts` | ~12 tests CRUD + anti-fraude |

## Fichiers à modifier

| Fichier | Modif |
|---------|-------|
| `prisma/schema.prisma` | Add CheckIn + CheckInStatus + back-relations |
| `prisma/migrations/...` | Auto-générée `add_checkin_model` |
| `src/lib/prisma-tenant.ts` | Add `"CheckIn"` à TENANT_SCOPED_MODELS |
| `tests/helpers/db.ts` | `checkIn.deleteMany()` en tête resetDb |
| `src/components/manager/nav.tsx` | Lien "Check-ins live" |
| `src/app/manager/page.tsx` | Stat "Présences aujourd'hui" (5e card ou remplace) |

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

Configuration Pusher manuelle par user (création app sur dashboard.pusher.com). En dev/test sans credentials → `pusherTrigger` est no-op (log console).

## Error handling client

| Cas | UI membre |
|-----|-----------|
| Géoloc denied | "Activez la localisation puis réessayez" + bouton retry |
| Géoloc timeout 10s | "Position introuvable. Activez le GPS." |
| Network error | Spinner → toast erreur + retry |
| `INVALID_QR` | "QR invalide. Demandez à l'accueil." |
| `WRONG_TENANT` | "Ce QR n'est pas pour votre salle." |
| `GEO_REJECTED` | 🚫 "Vous êtes à {distance}m. Approchez de l'entrée." |
| `DUPLICATE` | ℹ️ "Déjà enregistré aujourd'hui à {time}" |
| `NO_SUBSCRIPTION` | ⛔ "Aucun abonnement actif" + contact manager |
| `EXPIRED` | ⛔ "Abonnement expiré le {date}" + bouton "Renouveler" |
| `VALID` | ✅ "Bienvenue {name}. Valide jusqu'au {date}" |

## Pusher payload

Channel: `private-gym-{gymId}`
Event: `checkin`
Data:
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

## Testing

- Pusher mocké en tests (no-op si env absent) — vérification via spy
- DB tests via `testPrisma` + `resetDb` (Plan 4 pattern)
- Browser geolocation pas mocké dans CI (couvert manuel + Plan 8 mobile)

**Définition de Done:**
- Schema migration appliquée et `npm test` pass (~101 tests, 75 + 10 Plan 4 + ~16 Plan 5)
- `npm run typecheck` 0 errors
- Manuel: scan QR sur mobile réel → check-in en <2s sur dashboard manager
- Fallback manual check-in opérationnel
- 4+ états erreur testés visuellement sur mobile

## Risques + mitigations

| Risque | Mitigation |
|--------|-----------|
| GPS imprécis intérieur béton | Rayon 100m généreux + fallback manuel |
| Photo manquante membre | Déjà enforcé Plan 3 (avatar required) |
| Pusher quota free dépassé | Monitoring, switch Soketi plan B (même protocole, swap simple) |
| Membre scanne QR autre salle même tenant | OK (multi-salles tenant) — gym.tenantId vérifié |
| Membre d'autre tenant scanne QR | Bloqué par WRONG_TENANT check |
| Replay attack POST body | Cooldown 1/jour ⇒ DUPLICATE rejette |
| Connexion salle coupe | Fallback manual UI toujours dispo |

## Hors scope (Plan 5)

- App React Native (Plan 8)
- WhatsApp notifications check-in (Plan 7)
- Statistiques temporelles (graphiques fréquentation par heure/jour) — UI dashboard simple uniquement
- Géolocation iframe/embedded scanner — utilise `window.location.search` parsing standard
- Reconnaissance faciale photo (validation manager reste manuelle visuelle)
