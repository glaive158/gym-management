import React, { createContext, useContext, useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import * as authStore from "../lib/auth-store";

interface User {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

interface Ctx {
  token: string | null;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<Ctx | null>(null);

export const useAuth = () => {
  const v = useContext(AuthContext);
  if (!v) throw new Error("no AuthContext");
  return v;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setT] = useState<string | null>(null);
  const [user, setU] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const t = await authStore.getToken();
      if (t) {
        try {
          const u = await apiFetch<User>("/api/me/profile", { token: t });
          setT(t);
          setU(u);
        } catch {
          await authStore.clearToken();
        }
      }
      setLoading(false);
    })();
  }, []);

  async function login(email: string, password: string) {
    const r = await apiFetch<{ token: string; user: User }>("/api/mobile/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    await authStore.setToken(r.token);
    setT(r.token);
    setU(r.user);
  }

  async function logout() {
    await authStore.clearToken();
    setT(null);
    setU(null);
  }

  return <AuthContext.Provider value={{ token, user, loading, login, logout }}>{children}</AuthContext.Provider>;
}
