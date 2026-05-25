# Mobile App React Native Android Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** App React Native (Expo) Android pour les MEMBRES : login, scan QR check-in (camera + géoloc), profil, abonnement (+ bouton renouveler), historique présences. Publiable Play Store via EAS Build.

**Architecture:**
- **Backend** : ajouter routes mobile-friendly (`/api/mobile/auth/login` JWT bearer + `/api/me/profile` + `/api/me/subscriptions` + `/api/me/checkins`)
- **Mobile** : dossier `mobile/` dans le repo, app Expo TypeScript, react-navigation tabs, expo-camera, expo-location, expo-secure-store
- **Auth** : JWT signé avec `NEXTAUTH_SECRET`, stocké dans SecureStore, sent en `Authorization: Bearer <token>`
- **API client** : `apiFetch` wrapper avec base URL + auth header
- **5 écrans** : Login, Profil, Scan QR, Abonnement, Historique

**Tech Stack:** Expo SDK 51+, React Native, TypeScript, react-navigation (bottom tabs), expo-camera, expo-location, expo-secure-store, jose (JWT verify côté backend).

**Prerequisite:** Plan 7 mergé sur `main`. Node 18+. (EAS Build = compte Expo gratuit + 25$ Play Console pour publication.)

---

## File Structure

```
gym-management/
├── src/lib/
│   ├── jwt-mobile.ts                                  # signMobileToken + verifyMobileToken
│   └── server-actions/
│       └── mobile-auth.ts                             # loginMobile (email+password → JWT)
├── src/app/api/
│   ├── mobile/auth/login/route.ts                     # POST → JWT
│   ├── me/profile/route.ts                            # GET
│   ├── me/subscriptions/route.ts                      # GET
│   └── me/checkins/route.ts                           # GET
├── tests/lib/
│   ├── jwt-mobile.test.ts                             # ~3 tests
│   └── server-actions/mobile-auth.test.ts             # ~3 tests
└── mobile/                                            # Expo project
    ├── app.json
    ├── package.json
    ├── tsconfig.json
    ├── babel.config.js
    ├── App.tsx
    ├── src/
    │   ├── lib/
    │   │   ├── api.ts                                 # apiFetch + base URL
    │   │   ├── auth-store.ts                          # SecureStore wrappers
    │   │   └── types.ts                               # shared types (mirrored)
    │   ├── context/
    │   │   └── AuthContext.tsx                        # token state + login/logout
    │   ├── navigation/
    │   │   └── AppNavigator.tsx                       # tabs + auth gate
    │   └── screens/
    │       ├── LoginScreen.tsx
    │       ├── ProfileScreen.tsx
    │       ├── ScanScreen.tsx
    │       ├── SubscriptionScreen.tsx
    │       └── HistoryScreen.tsx
    └── README.md                                      # EAS Build + Play Store steps
```

---

## Task 1: Mobile JWT helper TDD (backend)

**Files:** `src/lib/jwt-mobile.ts`, `tests/lib/jwt-mobile.test.ts`. Install `jose`.

- [ ] **Step 1: Install jose**

```bash
npm install jose
```

- [ ] **Step 2: Failing test**

`tests/lib/jwt-mobile.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { signMobileToken, verifyMobileToken } from "@/lib/jwt-mobile";

const SECRET = "test-secret-must-be-long-enough-for-hs256";

describe("mobile JWT", () => {
  it("signs and verifies a token", async () => {
    const token = await signMobileToken({ userId: "u1", role: "MEMBER", tenantId: "t1" }, SECRET);
    expect(token.split(".")).toHaveLength(3);
    const payload = await verifyMobileToken(token, SECRET);
    expect(payload.userId).toBe("u1");
    expect(payload.role).toBe("MEMBER");
    expect(payload.tenantId).toBe("t1");
  });

  it("rejects token signed with wrong secret", async () => {
    const token = await signMobileToken({ userId: "u1", role: "MEMBER", tenantId: "t1" }, SECRET);
    await expect(verifyMobileToken(token, "other-secret-long-enough-for-hs256")).rejects.toThrow();
  });

  it("rejects malformed token", async () => {
    await expect(verifyMobileToken("not-a-jwt", SECRET)).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Implement**

`src/lib/jwt-mobile.ts`:
```typescript
import { SignJWT, jwtVerify } from "jose";

const ALG = "HS256";
const EXPIRES_IN = "30d";

export interface MobileTokenPayload {
  userId: string;
  role: string;
  tenantId: string | null;
}

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signMobileToken(payload: MobileTokenPayload, secret: string): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(EXPIRES_IN)
    .sign(key(secret));
}

export async function verifyMobileToken(token: string, secret: string): Promise<MobileTokenPayload> {
  const { payload } = await jwtVerify(token, key(secret), { algorithms: [ALG] });
  return {
    userId: payload.userId as string,
    role: payload.role as string,
    tenantId: (payload.tenantId as string | null) ?? null,
  };
}
```

- [ ] **Step 4: Test + commit**

```bash
npm test -- tests/lib/jwt-mobile.test.ts
git add -A && git commit -m "feat: add mobile JWT sign/verify helpers with tests"
```

---

## Task 2: Mobile login action + API route

**Files:** `src/lib/server-actions/mobile-auth.ts`, `tests/lib/server-actions/mobile-auth.test.ts`, `src/app/api/mobile/auth/login/route.ts`.

- [ ] **Step 1: Failing test**

`tests/lib/server-actions/mobile-auth.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, resetDb } from "../../helpers/db";
import { loginMobile } from "@/lib/server-actions/mobile-auth";
import { hashPassword } from "@/lib/password";
import { Role, TenantStatus, UserStatus } from "@prisma/client";

const SECRET = "test-secret-must-be-long-enough-for-hs256";

async function seedMember(password = "Hunter2Pass!") {
  const tenant = await testPrisma.tenant.create({
    data: { name: "T", slug: `t${Date.now()}${Math.random()}`, ownerEmail: "o@x.com", ownerPhone: "1", city: "Dakar", status: TenantStatus.ACTIVE },
  });
  const hash = await hashPassword(password);
  return testPrisma.user.create({
    data: { name: "M", email: `m${Date.now()}${Math.random()}@x.com`, passwordHash: hash, role: Role.MEMBER, status: UserStatus.ACTIVE, tenantId: tenant.id },
  });
}

describe("loginMobile", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("returns token + user on valid creds", async () => {
    const u = await seedMember();
    const r = await loginMobile({ email: u.email, password: "Hunter2Pass!", secret: SECRET, prisma: testPrisma });
    expect(r.success).toBe(true);
    expect(r.token).toBeTruthy();
    expect(r.user?.id).toBe(u.id);
  });

  it("rejects wrong password", async () => {
    const u = await seedMember();
    const r = await loginMobile({ email: u.email, password: "wrong", secret: SECRET, prisma: testPrisma });
    expect(r.success).toBe(false);
  });

  it("rejects non-MEMBER role", async () => {
    const tenant = await testPrisma.tenant.create({
      data: { name: "T", slug: `t${Date.now()}${Math.random()}`, ownerEmail: "o@x.com", ownerPhone: "1", city: "Dakar", status: TenantStatus.ACTIVE },
    });
    const hash = await hashPassword("pass1234");
    const admin = await testPrisma.user.create({
      data: { name: "A", email: `a${Date.now()}@x.com`, passwordHash: hash, role: Role.TENANT_ADMIN, status: UserStatus.ACTIVE, tenantId: tenant.id },
    });
    const r = await loginMobile({ email: admin.email, password: "pass1234", secret: SECRET, prisma: testPrisma });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Implement action**

`src/lib/server-actions/mobile-auth.ts`:
```typescript
import { PrismaClient, Role, UserStatus } from "@prisma/client";
import { verifyPassword } from "@/lib/password";
import { signMobileToken } from "@/lib/jwt-mobile";

export interface LoginMobileResult {
  success: boolean;
  token?: string;
  user?: { id: string; name: string; email: string; avatar: string | null };
  error?: string;
}

export async function loginMobile(input: {
  email: string;
  password: string;
  secret: string;
  prisma: PrismaClient;
}): Promise<LoginMobileResult> {
  const user = await input.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (!user || !user.passwordHash) return { success: false, error: "Identifiants invalides" };
  if (user.status !== UserStatus.ACTIVE) return { success: false, error: "Compte non actif" };
  if (user.role !== Role.MEMBER) return { success: false, error: "Application réservée aux membres" };

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) return { success: false, error: "Identifiants invalides" };

  const token = await signMobileToken(
    { userId: user.id, role: user.role, tenantId: user.tenantId },
    input.secret
  );
  return {
    success: true,
    token,
    user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar },
  };
}
```

- [ ] **Step 3: API route**

`src/app/api/mobile/auth/login/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loginMobile } from "@/lib/server-actions/mobile-auth";

export async function POST(req: Request) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  const body = await req.json();
  const r = await loginMobile({
    email: String(body.email ?? ""),
    password: String(body.password ?? ""),
    secret,
    prisma,
  });
  if (!r.success) return NextResponse.json({ error: r.error }, { status: 401 });
  return NextResponse.json({ token: r.token, user: r.user });
}
```

- [ ] **Step 4: Test + commit**

```bash
npm test -- tests/lib/server-actions/mobile-auth.test.ts
git add -A && git commit -m "feat: add mobile login action + API (POST /api/mobile/auth/login)"
```

---

## Task 3: Mobile bearer auth helper + /api/me/* routes

**Files:** `src/lib/mobile-auth-context.ts`, 3 `/api/me/*` routes.

- [ ] **Step 1: Bearer auth helper**

`src/lib/mobile-auth-context.ts`:
```typescript
import { verifyMobileToken, type MobileTokenPayload } from "@/lib/jwt-mobile";

export async function authMobileRequest(req: Request): Promise<MobileTokenPayload | null> {
  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  try {
    const payload = await verifyMobileToken(token, secret);
    if (payload.role !== "MEMBER") return null;
    return payload;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Profile route**

`src/app/api/me/profile/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMobileRequest } from "@/lib/mobile-auth-context";

export async function GET(req: Request) {
  const auth = await authMobileRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, name: true, email: true, phone: true, avatar: true, gym: { select: { id: true, name: true, address: true } } },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}
```

- [ ] **Step 3: Subscriptions route**

`src/app/api/me/subscriptions/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMobileRequest } from "@/lib/mobile-auth-context";

export async function GET(req: Request) {
  const auth = await authMobileRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const subs = await prisma.subscription.findMany({
    where: { memberId: auth.userId },
    orderBy: { endDate: "desc" },
    include: { plan: true },
  });
  return NextResponse.json(subs);
}
```

- [ ] **Step 4: Check-ins route**

`src/app/api/me/checkins/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMobileRequest } from "@/lib/mobile-auth-context";

export async function GET(req: Request) {
  const auth = await authMobileRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const checks = await prisma.checkIn.findMany({
    where: { memberId: auth.userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { gym: { select: { id: true, name: true } } },
  });
  return NextResponse.json(checks);
}
```

- [ ] **Step 5: Extend `/api/checkin` POST to accept bearer auth too**

In `src/app/api/checkin/route.ts`, replace the auth gate:
```typescript
import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { authMobileRequest } from "@/lib/mobile-auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { performCheckIn } from "@/lib/server-actions/checkin";

export async function POST(req: Request) {
  // Try web session first
  let userId: string | null = null;
  const webCtx = await getCurrentAuthContext();
  if (webCtx && webCtx.role === Role.MEMBER) userId = webCtx.userId;
  // Fallback to mobile bearer
  if (!userId) {
    const mobile = await authMobileRequest(req);
    if (mobile) userId = mobile.userId;
  }
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const lat = Number(body.latitude), lng = Number(body.longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return NextResponse.json({ error: "BAD_GEO" }, { status: 400 });
  const result = await performCheckIn({
    memberId: userId,
    qrToken: String(body.qrToken ?? ""),
    latitude: lat,
    longitude: lng,
    prisma,
  });
  return NextResponse.json(result);
}
```

- [ ] **Step 6: Build + commit**

```bash
npm run build
git add -A && git commit -m "feat: add /api/me/* mobile routes + bearer auth for /api/checkin"
```

---

## Task 4: Init Expo mobile project

**Files:** `mobile/` directory with Expo TypeScript template.

- [ ] **Step 1: Create Expo project**

```bash
cd /Users/admin/gym-management
npx create-expo-app@latest mobile --template blank-typescript --yes
cd mobile
npm install
```

- [ ] **Step 2: Install dependencies**

```bash
cd /Users/admin/gym-management/mobile
npx expo install expo-camera expo-location expo-secure-store
npm install @react-navigation/native @react-navigation/bottom-tabs @react-navigation/native-stack react-native-screens react-native-safe-area-context
```

- [ ] **Step 3: Add API base URL config**

Append to `mobile/app.json` `expo.extra`:
```json
"extra": {
  "apiBaseUrl": "http://10.0.2.2:3000"
}
```

(`10.0.2.2` = Android emulator's host loopback. On real device use your computer's LAN IP.)

- [ ] **Step 4: Commit**

```bash
cd /Users/admin/gym-management
echo "mobile/node_modules/" >> .gitignore
echo "mobile/.expo/" >> .gitignore
git add -A
git commit -m "chore: init Expo mobile app (TypeScript) + dependencies"
```

---

## Task 5: Auth context + API client + screens

**Files:** All `mobile/src/*` files.

- [ ] **Step 1: API client**

`mobile/src/lib/api.ts`:
```typescript
import Constants from "expo-constants";

const BASE = (Constants.expoConfig?.extra as any)?.apiBaseUrl ?? "http://10.0.2.2:3000";

export async function apiFetch<T = unknown>(path: string, opts: RequestInit & { token?: string | null } = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json as T;
}
```

- [ ] **Step 2: Auth store**

`mobile/src/lib/auth-store.ts`:
```typescript
import * as SecureStore from "expo-secure-store";
const KEY = "auth_token";
export const getToken = () => SecureStore.getItemAsync(KEY);
export const setToken = (t: string) => SecureStore.setItemAsync(KEY, t);
export const clearToken = () => SecureStore.deleteItemAsync(KEY);
```

- [ ] **Step 3: Auth context**

`mobile/src/context/AuthContext.tsx`:
```typescript
import React, { createContext, useContext, useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import * as authStore from "../lib/auth-store";

interface User { id: string; name: string; email: string; avatar: string | null }
interface Ctx {
  token: string | null;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
const AuthContext = createContext<Ctx | null>(null);
export const useAuth = () => { const v = useContext(AuthContext); if (!v) throw new Error("no AuthContext"); return v; };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setT] = useState<string | null>(null);
  const [user, setU] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    const t = await authStore.getToken();
    if (t) { try { const u = await apiFetch<User>("/api/me/profile", { token: t }); setT(t); setU(u); } catch { await authStore.clearToken(); } }
    setLoading(false);
  })(); }, []);

  async function login(email: string, password: string) {
    const r = await apiFetch<{ token: string; user: User }>("/api/mobile/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    await authStore.setToken(r.token);
    setT(r.token); setU(r.user);
  }
  async function logout() { await authStore.clearToken(); setT(null); setU(null); }

  return <AuthContext.Provider value={{ token, user, loading, login, logout }}>{children}</AuthContext.Provider>;
}
```

- [ ] **Step 4: Navigation**

`mobile/src/navigation/AppNavigator.tsx`:
```typescript
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useAuth } from "../context/AuthContext";
import { LoginScreen } from "../screens/LoginScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { ScanScreen } from "../screens/ScanScreen";
import { SubscriptionScreen } from "../screens/SubscriptionScreen";
import { HistoryScreen } from "../screens/HistoryScreen";

const Tab = createBottomTabNavigator();

export function AppNavigator() {
  const { token, loading } = useAuth();
  if (loading) return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator size="large" /></View>;
  return (
    <NavigationContainer>
      {!token ? <LoginScreen /> : (
        <Tab.Navigator screenOptions={{ headerShown: true }}>
          <Tab.Screen name="Scan" component={ScanScreen} />
          <Tab.Screen name="Abonnement" component={SubscriptionScreen} />
          <Tab.Screen name="Historique" component={HistoryScreen} />
          <Tab.Screen name="Profil" component={ProfileScreen} />
        </Tab.Navigator>
      )}
    </NavigationContainer>
  );
}
```

- [ ] **Step 5: Login screen**

`mobile/src/screens/LoginScreen.tsx`:
```typescript
import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet, Alert } from "react-native";
import { useAuth } from "../context/AuthContext";

export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try { await login(email, password); } catch (e: any) { Alert.alert("Erreur", e.message); }
    setLoading(false);
  }

  return (
    <View style={s.wrap}>
      <Text style={s.title}>Connexion</Text>
      <TextInput placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} style={s.input} />
      <TextInput placeholder="Mot de passe" secureTextEntry value={password} onChangeText={setPassword} style={s.input} />
      <Button title={loading ? "..." : "Se connecter"} onPress={submit} disabled={loading} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 24, justifyContent: "center", backgroundColor: "#0f172a" },
  title: { fontSize: 24, fontWeight: "600", marginBottom: 20, color: "#f1f5f9", textAlign: "center" },
  input: { borderWidth: 1, borderColor: "#334155", backgroundColor: "#1e293b", color: "#f1f5f9", padding: 12, borderRadius: 6, marginBottom: 12 },
});
```

- [ ] **Step 6: Profile screen**

`mobile/src/screens/ProfileScreen.tsx`:
```typescript
import React from "react";
import { View, Text, Image, Button, StyleSheet } from "react-native";
import { useAuth } from "../context/AuthContext";

export function ProfileScreen() {
  const { user, logout } = useAuth();
  return (
    <View style={s.wrap}>
      {user?.avatar && <Image source={{ uri: user.avatar }} style={s.avatar} />}
      <Text style={s.name}>{user?.name}</Text>
      <Text style={s.email}>{user?.email}</Text>
      <View style={{ marginTop: 24 }}><Button title="Déconnexion" color="#ef4444" onPress={logout} /></View>
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { flex: 1, padding: 24, alignItems: "center", justifyContent: "center", backgroundColor: "#0f172a" },
  avatar: { width: 96, height: 96, borderRadius: 48, marginBottom: 16 },
  name: { fontSize: 20, fontWeight: "600", color: "#f1f5f9" },
  email: { fontSize: 14, color: "#94a3b8", marginTop: 4 },
});
```

- [ ] **Step 7: Scan screen (camera + geoloc + POST checkin)**

`mobile/src/screens/ScanScreen.tsx`:
```typescript
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Button, ActivityIndicator } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export function ScanScreen() {
  const { token } = useAuth();
  const [perm, requestPerm] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (perm && !perm.granted) requestPerm(); }, [perm]);

  async function handle(data: string) {
    if (loading) return;
    setScanned(true);
    setLoading(true);
    try {
      const qr = new URL(data).searchParams.get("gym") ?? data;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setResult({ error: "GEO_DENIED" }); setLoading(false); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const r = await apiFetch("/api/checkin", {
        method: "POST",
        token,
        body: JSON.stringify({ qrToken: qr, latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      });
      setResult(r);
    } catch (e: any) {
      setResult({ error: e.message });
    }
    setLoading(false);
  }

  if (!perm?.granted) return <View style={s.wrap}><Text style={s.txt}>Autorisation caméra requise.</Text></View>;

  if (result) {
    return (
      <View style={s.wrap}>
        <Text style={s.bigStatus}>{JSON.stringify(result, null, 2)}</Text>
        <Button title="Scanner à nouveau" onPress={() => { setResult(null); setScanned(false); }} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanned ? undefined : (e) => handle(e.data)}
      />
      {loading && <View style={s.overlay}><ActivityIndicator size="large" color="#fff" /><Text style={s.txt}>Vérification…</Text></View>}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 24, justifyContent: "center", backgroundColor: "#0f172a" },
  txt: { color: "#f1f5f9", textAlign: "center", marginBottom: 12 },
  bigStatus: { color: "#f1f5f9", fontSize: 14, marginBottom: 16, fontFamily: "monospace" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center" },
});
```

- [ ] **Step 8: Subscription screen**

`mobile/src/screens/SubscriptionScreen.tsx`:
```typescript
import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";

interface Sub { id: string; startDate: string; endDate: string; status: string; plan: { name: string; price: number; durationDays: number } }

export function SubscriptionScreen() {
  const { token } = useAuth();
  const [subs, setSubs] = useState<Sub[] | null>(null);
  useEffect(() => { (async () => { setSubs(await apiFetch<Sub[]>("/api/me/subscriptions", { token })); })(); }, [token]);

  if (!subs) return <View style={s.wrap}><ActivityIndicator /></View>;
  const active = subs.find((x) => x.status === "ACTIVE" && new Date(x.endDate) > new Date());

  return (
    <View style={s.wrap}>
      {active ? (
        <View style={s.card}>
          <Text style={s.label}>Abonnement actuel</Text>
          <Text style={s.value}>{active.plan.name}</Text>
          <Text style={s.txt}>Expire le {new Date(active.endDate).toLocaleDateString("fr-FR")}</Text>
        </View>
      ) : (
        <View style={s.card}><Text style={s.txt}>Aucun abonnement actif. Contactez le gérant pour renouveler.</Text></View>
      )}
      <Text style={[s.label, { marginTop: 24 }]}>Historique</Text>
      <FlatList
        data={subs}
        keyExtractor={(it) => it.id}
        renderItem={({ item }) => (
          <View style={s.row}>
            <Text style={s.value}>{item.plan.name} · {item.status}</Text>
            <Text style={s.txt}>{new Date(item.startDate).toLocaleDateString("fr-FR")} → {new Date(item.endDate).toLocaleDateString("fr-FR")}</Text>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16, backgroundColor: "#0f172a" },
  card: { backgroundColor: "#1e293b", padding: 16, borderRadius: 8, marginBottom: 12 },
  row: { backgroundColor: "#1e293b", padding: 12, borderRadius: 6, marginBottom: 8 },
  label: { color: "#94a3b8", fontSize: 12, textTransform: "uppercase", marginBottom: 4 },
  value: { color: "#f1f5f9", fontSize: 16, fontWeight: "600" },
  txt: { color: "#94a3b8", fontSize: 13, marginTop: 4 },
});
```

- [ ] **Step 9: History screen**

`mobile/src/screens/HistoryScreen.tsx`:
```typescript
import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";

interface CheckIn { id: string; status: string; source: string; createdAt: string; gym: { name: string } }

export function HistoryScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<CheckIn[] | null>(null);
  useEffect(() => { (async () => { setItems(await apiFetch<CheckIn[]>("/api/me/checkins", { token })); })(); }, [token]);

  if (!items) return <View style={s.wrap}><ActivityIndicator /></View>;

  return (
    <View style={s.wrap}>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        ListEmptyComponent={<Text style={s.txt}>Aucun check-in.</Text>}
        renderItem={({ item }) => (
          <View style={s.row}>
            <Text style={s.title}>{item.gym.name}</Text>
            <Text style={s.txt}>{item.status} · {item.source} · {new Date(item.createdAt).toLocaleString("fr-FR")}</Text>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16, backgroundColor: "#0f172a" },
  row: { backgroundColor: "#1e293b", padding: 12, borderRadius: 6, marginBottom: 8 },
  title: { color: "#f1f5f9", fontWeight: "600" },
  txt: { color: "#94a3b8", fontSize: 12, marginTop: 4 },
});
```

- [ ] **Step 10: App.tsx**

`mobile/App.tsx`:
```typescript
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "./src/context/AuthContext";
import { AppNavigator } from "./src/navigation/AppNavigator";

export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
      <StatusBar style="light" />
    </AuthProvider>
  );
}
```

- [ ] **Step 11: Commit**

```bash
cd /Users/admin/gym-management
git add -A
git commit -m "feat(mobile): add 5 screens + auth context + API client"
```

---

## Task 6: README mobile + EAS Build instructions

**File:** `mobile/README.md`.

- [ ] **Step 1: Write README**

`mobile/README.md`:
```markdown
# Gym Management — App mobile (Android)

App React Native (Expo) pour les membres. Login, scan QR check-in, profil, abonnement, historique.

## Setup dev

```bash
cd mobile
npm install
npx expo start
```

- Sur Android emulator : appuyer `a`
- Sur device physique : installer **Expo Go** (Play Store) + scanner le QR affiché

## Config API

Édite `app.json` → `expo.extra.apiBaseUrl`:
- Emulator Android : `http://10.0.2.2:3000`
- Device physique : `http://<IP_LAN_PC>:3000` (ex: `192.168.1.42`)
- Production : `https://app.tonsite.com`

## Build Android pour Play Store (EAS Build)

1. Créer compte Expo : https://expo.dev (gratuit)
2. Login + init :
   ```bash
   npm install -g eas-cli
   eas login
   eas build:configure
   ```
3. Build APK de test :
   ```bash
   eas build --platform android --profile preview
   ```
4. Build AAB pour Play Store :
   ```bash
   eas build --platform android --profile production
   ```
5. Compte Google Play Console (25$ une fois) : https://play.google.com/console
6. Créer fiche application + upload AAB
7. Validation Google : 1-7 jours

## Permissions Android (déjà configurées via expo-camera + expo-location)

- CAMERA (scan QR)
- ACCESS_FINE_LOCATION (anti-fraude géoloc)

## Notifications push (phase 3)

À ajouter : `expo-notifications` + token Expo push + endpoint backend pour push.

## Tests sur device physique

1. Connecter Android au même WiFi que le PC
2. Trouver IP du PC : `ifconfig | grep "inet "` (Mac/Linux) ou `ipconfig` (Win)
3. Mettre cette IP dans `app.json` → `apiBaseUrl`
4. Démarrer backend : `cd .. && npm run dev`
5. `cd mobile && npx expo start`
6. Scanner QR dans Expo Go
```

- [ ] **Step 2: Commit**

```bash
git add mobile/README.md
git commit -m "docs(mobile): add README with setup + EAS Build + Play Store steps"
```

---

## Task 7: End-to-end verification

- [ ] **Step 1: Backend tests + build**

```bash
cd /Users/admin/gym-management
npm test
npm run typecheck
npm run build
```
Expected: all green, +6 new tests (jwt 3 + mobile-auth 3) → 132 total.

- [ ] **Step 2: Mobile install verify**

```bash
cd mobile
npm install
```
Expected: install succeeds. (Build/run requires Android emulator or device — skipped in CI.)

- [ ] **Step 3: Final commit**

```bash
cd /Users/admin/gym-management
git add -A && git status && git commit --allow-empty -m "chore: mobile Android app milestone (Plan 8)"
```

---

## Done criteria
- 6 nouveaux tests backend pass
- `/api/mobile/auth/login` + `/api/me/*` routes opérationnelles
- `/api/checkin` accepte bearer auth + cookie session
- App Expo se lance dans Expo Go (login + scan + screens fonctionnent end-to-end avec emulator/device)
- README explique EAS Build + Play Store

## Hors périmètre

- Notifications push (Expo Push) → phase 3
- iOS App Store → phase 3
- App MANAGER mobile → phase 3
- Renouvellement online dans app → integration Wave/OM/PayDunya redirect → phase 3
