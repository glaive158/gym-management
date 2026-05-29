# PayDunya Online Payments — Design

**Date:** 2026-05-29
**Statut:** Approuvé

## Contexte

Permettre le paiement en ligne des abonnements membres via PayDunya (Checkout Invoice API). Aujourd'hui les paiements sont saisis manuellement par le manager. Objectif : membre paie en ligne → PayDunya confirme → paiement enregistré + abonnement activé automatiquement.

## Décisions

- Compte PayDunya : **sandbox d'abord** (`PAYDUNYA_MODE=test`), bascule prod via env.
- Déclencheurs : **membre** (self-service depuis `/me`) **et manager** (génère un lien).
- Réconciliation par **IPN** (webhook PayDunya) + vérification via confirm API.

## Schéma

Nouveau modèle `PaymentIntent` (paiement en attente, réconcilié à la confirmation) :

```
model PaymentIntent {
  id            String              @id @default(cuid())
  tenantId      String
  gymId         String
  memberId      String
  planId        String
  amount        Int
  token         String?   @unique   // token facture PayDunya
  status        PaymentIntentStatus @default(PENDING)
  paymentId     String?             // Payment créé à la confirmation
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

enum PaymentIntentStatus { PENDING COMPLETED FAILED CANCELLED }
```

## Lib `src/lib/paydunya.ts`

- `createInvoice({ amount, description, customData, callbackUrl, returnUrl, cancelUrl })` → `{ token, redirectUrl }` ; no-op/erreur claire si env absent.
- `confirmInvoice(token)` → `{ status, customData }` (status PayDunya : `completed` / `pending` / `cancelled`).
- Base URL selon `PAYDUNYA_MODE` : `https://app.paydunya.com/sandbox-api/v1` (test) vs `/api/v1` (live).
- Headers : `PAYDUNYA-MASTER-KEY`, `PAYDUNYA-PRIVATE-KEY`, `PAYDUNYA-TOKEN`.

## Server actions

- `initiatePayment({ tenantId, gymId, memberId, planId })` → crée `PaymentIntent` PENDING + `createInvoice` (custom_data = intentId) → retourne `redirectUrl`. Stocke `token`.
- `confirmPayment({ token })` → `confirmInvoice` → si `completed` et intent PENDING : `assignSubscription` + `createPayment` (method PAYDUNYA, reference=token) + intent COMPLETED + lie `paymentId`. Idempotent (skip si déjà COMPLETED).

## API routes

- `POST /api/payments/paydunya/initiate` — auth MANAGER (memberId fourni) ou MEMBER (self, memberId=session). Body `{ planId, memberId? }`. → `{ redirectUrl }`.
- `POST /api/payments/paydunya/callback` — IPN PayDunya (public, pas de session). Body PayDunya → extrait token → `confirmPayment`. Renvoie 200.
- Public route : ajouter `/api/payments/paydunya/callback` traverse middleware (déjà bypass `/api/`).

## UI

- Membre `/me` : section "Renouveler / Payer" → liste formules de sa salle → bouton "Payer en ligne" → POST initiate → redirect `redirectUrl`. Retour `/me?payment=success|cancel`.
- Manager fiche membre : bouton "Lien paiement en ligne" → POST initiate → affiche/copie `redirectUrl` à envoyer au membre.

## Env

```
PAYDUNYA_MODE=test
PAYDUNYA_MASTER_KEY=
PAYDUNYA_PRIVATE_KEY=
PAYDUNYA_TOKEN=
PAYDUNYA_STORE_NAME=Kaytech Gym
```

## Tests (TDD)

- `paydunya.ts` : createInvoice/confirmInvoice avec fetch mocké (mode test URL, headers, parsing).
- `initiatePayment` : crée intent PENDING + token.
- `confirmPayment` : completed → Payment + subscription + intent COMPLETED ; idempotent ; non-completed → pas d'effet.

## Hors scope

- Remboursements, abonnements récurrents auto-renew via PayDunya, autres PSP (Wave/OM direct API).
