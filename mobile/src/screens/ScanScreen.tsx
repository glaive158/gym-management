import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";

interface CheckInResponse {
  status?: string;
  error?: string;
  memberName?: string;
  expiresAt?: string | null;
  distanceMeters?: number;
}

export function ScanScreen() {
  const { token } = useAuth();
  const [perm, requestPerm] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [result, setResult] = useState<CheckInResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (perm && !perm.granted) requestPerm();
  }, [perm, requestPerm]);

  async function handle(data: string) {
    if (loading || scanned) return;
    setScanned(true);
    setLoading(true);
    try {
      let qr = data;
      try { qr = new URL(data).searchParams.get("gym") ?? data; } catch { /* not a URL */ }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setResult({ error: "GEO_DENIED" });
        setLoading(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const r = await apiFetch<CheckInResponse>("/api/checkin", {
        method: "POST",
        token,
        body: JSON.stringify({ qrToken: qr, latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      });
      setResult(r);
    } catch (e: unknown) {
      setResult({ error: e instanceof Error ? e.message : "NETWORK" });
    }
    setLoading(false);
  }

  function reset() {
    setResult(null);
    setScanned(false);
  }

  if (!perm) return <View style={s.wrap}><ActivityIndicator color="#fff" /></View>;
  if (!perm.granted) return (
    <View style={s.wrap}>
      <Text style={s.txt}>Autorisation caméra requise.</Text>
      <Pressable onPress={requestPerm} style={s.btn}><Text style={s.btnText}>Autoriser</Text></Pressable>
    </View>
  );

  if (result) {
    const color =
      result.status === "VALID" ? "#16a34a" :
      result.status === "DUPLICATE" ? "#2563eb" :
      result.status === "GEO_REJECTED" ? "#f59e0b" :
      "#ef4444";
    const label =
      result.error === "INVALID_QR" ? "QR invalide" :
      result.error === "WRONG_TENANT" ? "QR pour autre salle" :
      result.error === "GEO_DENIED" ? "Position refusée" :
      result.error === "BAD_GEO" ? "Position invalide" :
      result.error ? result.error :
      result.status === "VALID" ? `✅ Bienvenue ${result.memberName ?? ""}` :
      result.status === "DUPLICATE" ? "Déjà enregistré aujourd'hui" :
      result.status === "EXPIRED" ? "Abonnement expiré" :
      result.status === "NO_SUBSCRIPTION" ? "Aucun abonnement actif" :
      result.status === "GEO_REJECTED" ? `Hors zone (${result.distanceMeters}m)` :
      "—";

    return (
      <View style={s.wrap}>
        <View style={[s.card, { backgroundColor: color }]}>
          <Text style={s.cardText}>{label}</Text>
          {result.expiresAt && (
            <Text style={s.cardSub}>Expire le {new Date(result.expiresAt).toLocaleDateString("fr-FR")}</Text>
          )}
        </View>
        <Pressable onPress={reset} style={s.btn}><Text style={s.btnText}>Scanner à nouveau</Text></Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanned ? undefined : (e) => handle(e.data)}
      />
      <View style={s.scanFrame} pointerEvents="none" />
      {loading && (
        <View style={s.overlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={s.txt}>Vérification…</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 24, justifyContent: "center", alignItems: "center", backgroundColor: "#0f172a" },
  txt: { color: "#f1f5f9", textAlign: "center", marginVertical: 12, fontSize: 16 },
  card: { padding: 24, borderRadius: 12, marginBottom: 24, alignItems: "center", width: "100%" },
  cardText: { color: "#fff", fontSize: 22, fontWeight: "700", textAlign: "center" },
  cardSub: { color: "#fff", fontSize: 14, marginTop: 8, opacity: 0.85 },
  btn: { backgroundColor: "#2563eb", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  scanFrame: {
    position: "absolute", top: "30%", left: "15%", width: "70%", height: "40%",
    borderColor: "rgba(255,255,255,0.7)", borderWidth: 2, borderRadius: 12,
  },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center" },
});
