# Deployment Design — Gym Management SaaS

**Date:** 2026-05-27
**Statut:** Approuvé

---

## Contexte

Déployer le projet Gym Management SaaS (Next.js 14 + PostgreSQL + app mobile React Native) sur un VPS Linux (Ubuntu/Debian) avec Docker, et publier l'app Android sur le Play Store.

---

## Partie 1 — VPS : Next.js + PostgreSQL (Docker Compose)

### Approche retenue

Docker Compose minimal : 2 services (`app` + `db`), accès via `http://IP:3000`. Nginx + SSL ajoutés plus tard quand un domaine est disponible.

### Architecture

```
VPS Ubuntu/Debian
├── /opt/gym-management/          ← répertoire projet
│   ├── docker-compose.yml        ← orchestration
│   ├── Dockerfile                ← multi-stage build Next.js
│   ├── .env.production           ← secrets (jamais dans git)
│   └── (code source cloné)
│
├── Service: app
│   ├── Image: multi-stage (node:20-alpine builder → runner)
│   ├── Port: 3000 exposé sur l'hôte
│   ├── Env: DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, etc.
│   └── Restart: always
│
└── Service: db
    ├── Image: postgres:16-alpine
    ├── Volume: postgres_data (persistant)
    ├── Port: 5432 (interne seulement, non exposé)
    └── Restart: always
```

### Dockerfile (multi-stage)

```
Stage 1 — deps     : npm ci (production deps)
Stage 2 — builder  : npm ci (all deps) + ARG NEXT_PUBLIC_* + npm run build
Stage 3 — runner   : node:20-alpine + copie .next/standalone + public + static
```

Utilise `output: 'standalone'` dans `next.config.mjs` pour image minimale (~200MB).

> **Important :** `NEXT_PUBLIC_*` sont injectées **au build** (pas au runtime). Les passer comme `ARG` dans le stage builder du Dockerfile, puis comme `build_args` dans `docker-compose.yml`. Seules `NEXT_PUBLIC_PUSHER_KEY` et `NEXT_PUBLIC_PUSHER_CLUSTER` sont concernées (optionnelles si Pusher non configuré).

### Modification next.config.mjs requise

```js
const nextConfig = { output: 'standalone' };
export default nextConfig;
```

### Variables d'environnement production

```
DATABASE_URL=postgresql://gymapp:PASSWORD@db:5432/gym_management
NEXTAUTH_SECRET=<générer avec openssl rand -base64 32>
NEXTAUTH_URL=http://IP_VPS:3000
APP_URL=http://IP_VPS:3000
RESEND_API_KEY=<clé Resend>
EMAIL_FROM=Gym SaaS <no-reply@domaine.com>
CRON_SECRET=<générer avec openssl rand -base64 32>
PUSHER_APP_ID=<optionnel>
PUSHER_KEY=<optionnel>
PUSHER_SECRET=<optionnel>
PUSHER_CLUSTER=eu
NEXT_PUBLIC_PUSHER_KEY=<optionnel>
NEXT_PUBLIC_PUSHER_CLUSTER=eu
WHATSAPP_PHONE_ID=<optionnel>
WHATSAPP_TOKEN=<optionnel>
POSTGRES_USER=gymapp
POSTGRES_PASSWORD=<mot de passe fort>
POSTGRES_DB=gym_management
```

### Séquence de déploiement initial

```bash
# Sur le VPS (SSH)
sudo apt update && sudo apt install -y docker.io docker-compose git
git clone <repo> /opt/gym-management
cd /opt/gym-management
cp .env.example .env.production   # remplir les secrets
docker-compose up -d --build
docker-compose exec app npx prisma migrate deploy
docker-compose exec app npx tsx prisma/seed.ts
```

### Mise à jour (déploiement suivant)

```bash
ssh user@IP
cd /opt/gym-management
git pull
docker-compose up -d --build
docker-compose exec app npx prisma migrate deploy
```

### Fichiers à créer

| Fichier | Description |
|---------|-------------|
| `Dockerfile` | Multi-stage build Next.js standalone |
| `docker-compose.yml` | Services app + db |
| `.env.example` | Template variables (sans secrets) |
| `.dockerignore` | Exclure node_modules, .env*, mobile/ |

---

## Partie 2 — Mobile : App Android → Play Store

### Approche retenue

EAS Build (cloud Expo) pour générer le `.aab` (Android App Bundle), upload manuel sur Google Play Console.

### Prérequis

- Compte Google Play Developer (25 USD, paiement unique)
- Compte Expo (gratuit) + EAS CLI
- `apiBaseUrl` dans `mobile/app.json` mis à jour → `http://IP_VPS:3000`

### Séquence Play Store

```
1. Créer compte Google Play Developer
   → play.google.com/console → Payer 25 USD

2. Mettre à jour apiBaseUrl dans mobile/app.json
   → "apiBaseUrl": "http://IP_VPS:3000"

3. Build production AAB
   → cd mobile
   → eas build --platform android --profile production
   → Expo compile en cloud (~10-15 min)
   → Télécharger le .aab

4. Créer l'app sur Play Console
   → "Créer une application"
   → Nom: Gym Management
   → Type: Application

5. Remplir la fiche store
   → Description courte (80 chars)
   → Description longue (4000 chars)
   → 2+ captures d'écran Android (min 320px)
   → Icône 512×512 PNG

6. Upload AAB
   → Tests internes → Production
   → Soumettre pour review (1-3 jours ouvrés)
```

### Mises à jour app mobile

Chaque nouvelle version :
```bash
# Incrémenter versionCode dans app.json (ou autoIncrement EAS)
eas build --platform android --profile production
# Upload nouveau .aab sur Play Console
```

---

## Ordre d'exécution recommandé

1. **VPS d'abord** — déployer et tester l'API accessible via IP
2. **Mobile ensuite** — mettre à jour `apiBaseUrl`, builder l'APK, soumettre Play Store

---

## Hors scope (phase suivante)

- Nginx reverse proxy + domaine personnalisé
- SSL/TLS Let's Encrypt (Certbot)
- GitHub Actions CI/CD
- Monitoring / alertes
- Backups PostgreSQL automatiques
