# Gym Management — App mobile (Android)

App React Native (Expo) pour les membres. Login, scan QR check-in, profil, abonnement, historique.

## Setup dev

```bash
cd mobile
npm install
npx expo start
```

- Sur Android emulator : appuyer `a` dans le terminal Expo
- Sur device physique : installer **Expo Go** (Play Store) + scanner le QR affiché

## Configuration API

Édite `app.json` → `expo.extra.apiBaseUrl` :
- Emulator Android : `http://10.0.2.2:3000`
- Device physique : `http://<IP_LAN_PC>:3000` (ex : `192.168.1.42`)
- Production : `https://app.tonsite.com`

Trouver IP du PC :
```bash
ifconfig | grep "inet "      # Mac/Linux
ipconfig                     # Windows
```

## Architecture

```
mobile/
├── App.tsx                              # entry point (AuthProvider + AppNavigator)
├── src/
│   ├── lib/
│   │   ├── api.ts                       # apiFetch wrapper (base URL + Bearer)
│   │   └── auth-store.ts                # SecureStore token persist
│   ├── context/
│   │   └── AuthContext.tsx              # login/logout + auto-restore
│   ├── navigation/
│   │   └── AppNavigator.tsx             # tabs + auth gate
│   └── screens/
│       ├── LoginScreen.tsx
│       ├── ProfileScreen.tsx
│       ├── ScanScreen.tsx               # camera + geoloc + check-in
│       ├── SubscriptionScreen.tsx
│       └── HistoryScreen.tsx
```

## Build Android pour Play Store (EAS Build)

1. Créer compte Expo : https://expo.dev (gratuit)
2. Login + init :
   ```bash
   npm install -g eas-cli
   eas login
   eas build:configure
   ```
3. Build APK de test (installable sur device) :
   ```bash
   eas build --platform android --profile preview
   ```
4. Build AAB pour Play Store :
   ```bash
   eas build --platform android --profile production
   ```
5. Compte Google Play Console (25 USD une fois) : https://play.google.com/console
6. Créer fiche application + upload AAB
7. Validation Google : 1-7 jours

## Permissions Android (configurées via plugins Expo)

- `CAMERA` (scan QR via expo-camera)
- `ACCESS_FINE_LOCATION` (anti-fraude géoloc via expo-location)
- SecureStore utilise Keystore Android

## Tests sur device physique

1. Connecter Android au même WiFi que le PC
2. Mettre IP LAN du PC dans `app.json` → `apiBaseUrl`
3. Démarrer backend : `cd .. && npm run dev`
4. `cd mobile && npx expo start`
5. Scanner QR dans Expo Go

## Notifications push (hors MVP)

À ajouter en phase 3 :
- `npx expo install expo-notifications`
- Token Expo push enregistré côté backend
- Endpoint POST `/api/notifications/push` qui appelle Expo Push API

## iOS App Store (hors MVP)

```bash
eas build --platform ios --profile production
```
Nécessite compte Apple Developer (99 USD/an).

## Comptes test (après seed)

L'app accepte uniquement les utilisateurs avec `role = MEMBER`. Créer un membre depuis le dashboard MANAGER puis se logger avec son email/mot de passe.

Le PLATFORM_OWNER `owner@platform.local` n'a PAS accès à l'app mobile (réservée aux membres).
