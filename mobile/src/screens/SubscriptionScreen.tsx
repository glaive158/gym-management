import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";

interface Sub {
  id: string;
  startDate: string;
  endDate: string;
  status: string;
  plan: { name: string; price: number; durationDays: number };
}

export function SubscriptionScreen() {
  const { token } = useAuth();
  const [subs, setSubs] = useState<Sub[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch<Sub[]>("/api/me/subscriptions", { token });
        setSubs(r);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    })();
  }, [token]);

  if (error) return <View style={s.wrap}><Text style={s.err}>{error}</Text></View>;
  if (!subs) return <View style={s.wrap}><ActivityIndicator color="#fff" /></View>;

  const active = subs.find((x) => x.status === "ACTIVE" && new Date(x.endDate) > new Date());

  return (
    <View style={s.wrap}>
      {active ? (
        <View style={s.activeCard}>
          <Text style={s.label}>Abonnement actuel</Text>
          <Text style={s.bigValue}>{active.plan.name}</Text>
          <Text style={s.txt}>
            Expire le {new Date(active.endDate).toLocaleDateString("fr-FR")}
          </Text>
        </View>
      ) : (
        <View style={s.warnCard}>
          <Text style={s.warnText}>Aucun abonnement actif.</Text>
          <Text style={s.warnSub}>Contactez le gérant pour renouveler.</Text>
        </View>
      )}
      <Text style={[s.label, { marginTop: 24, marginLeft: 4 }]}>Historique</Text>
      <FlatList
        data={subs}
        keyExtractor={(it) => it.id}
        renderItem={({ item }) => (
          <View style={s.row}>
            <Text style={s.value}>
              {item.plan.name} · <Text style={{ color: item.status === "ACTIVE" ? "#34d399" : "#94a3b8" }}>{item.status}</Text>
            </Text>
            <Text style={s.txt}>
              {new Date(item.startDate).toLocaleDateString("fr-FR")} → {new Date(item.endDate).toLocaleDateString("fr-FR")}
            </Text>
            <Text style={s.price}>{item.plan.price.toLocaleString("fr-FR")} XOF</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={s.txt}>Aucun abonnement.</Text>}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16, backgroundColor: "#0f172a" },
  activeCard: { backgroundColor: "#064e3b", padding: 20, borderRadius: 12, borderColor: "#10b981", borderWidth: 1 },
  warnCard: { backgroundColor: "#78350f", padding: 20, borderRadius: 12, borderColor: "#f59e0b", borderWidth: 1 },
  warnText: { color: "#fcd34d", fontSize: 16, fontWeight: "600" },
  warnSub: { color: "#fef3c7", fontSize: 13, marginTop: 4 },
  row: { backgroundColor: "#1e293b", padding: 12, borderRadius: 8, marginBottom: 8 },
  label: { color: "#94a3b8", fontSize: 12, textTransform: "uppercase", marginBottom: 6 },
  bigValue: { color: "#f1f5f9", fontSize: 22, fontWeight: "700" },
  value: { color: "#f1f5f9", fontSize: 16, fontWeight: "600" },
  txt: { color: "#94a3b8", fontSize: 13, marginTop: 4 },
  price: { color: "#10b981", fontSize: 14, marginTop: 4, fontWeight: "600" },
  err: { color: "#fca5a5", textAlign: "center", padding: 20 },
});
