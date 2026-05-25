import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";

interface CheckIn {
  id: string;
  status: string;
  source: string;
  createdAt: string;
  gym: { name: string };
}

const STATUS_COLOR: Record<string, string> = {
  VALID: "#10b981",
  EXPIRED: "#ef4444",
  DUPLICATE: "#3b82f6",
  NO_SUBSCRIPTION: "#ef4444",
  GEO_REJECTED: "#f59e0b",
};

const STATUS_LABEL: Record<string, string> = {
  VALID: "À jour",
  EXPIRED: "Expiré",
  DUPLICATE: "Doublon",
  NO_SUBSCRIPTION: "Pas d'abonnement",
  GEO_REJECTED: "Hors zone",
};

export function HistoryScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<CheckIn[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch<CheckIn[]>("/api/me/checkins", { token });
        setItems(r);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    })();
  }, [token]);

  if (error) return <View style={s.wrap}><Text style={s.err}>{error}</Text></View>;
  if (!items) return <View style={s.wrap}><ActivityIndicator color="#fff" /></View>;

  return (
    <View style={s.wrap}>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        ListEmptyComponent={<Text style={s.empty}>Aucun check-in pour le moment.</Text>}
        renderItem={({ item }) => (
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{item.gym.name}</Text>
              <Text style={s.txt}>
                {item.source} · {new Date(item.createdAt).toLocaleString("fr-FR")}
              </Text>
            </View>
            <View style={[s.badge, { backgroundColor: STATUS_COLOR[item.status] ?? "#475569" }]}>
              <Text style={s.badgeText}>{STATUS_LABEL[item.status] ?? item.status}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16, backgroundColor: "#0f172a" },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: "#1e293b", padding: 12, borderRadius: 8, marginBottom: 8 },
  title: { color: "#f1f5f9", fontWeight: "600", fontSize: 15 },
  txt: { color: "#94a3b8", fontSize: 12, marginTop: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  empty: { color: "#94a3b8", textAlign: "center", padding: 32 },
  err: { color: "#fca5a5", textAlign: "center", padding: 20 },
});
