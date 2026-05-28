import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView } from "react-native";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

export function ChangePasswordScreen() {
  const { token, user, refreshUser } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    if (next.length < 8) {
      setError("Mot de passe trop court (8 caractères minimum)");
      return;
    }
    if (next !== confirm) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/api/me/password", {
        method: "POST",
        token,
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      await refreshUser();
      setCurrent("");
      setNext("");
      setConfirm("");
      Alert.alert("Succès", "Mot de passe changé.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={s.wrap}>
      {user?.mustChangePassword && (
        <View style={s.banner}>
          <Text style={s.bannerText}>
            Pour votre sécurité, changez le mot de passe qui vous a été communiqué.
          </Text>
        </View>
      )}
      <Text style={s.label}>Mot de passe actuel</Text>
      <TextInput
        style={s.input}
        secureTextEntry
        value={current}
        onChangeText={setCurrent}
        placeholder="••••••••"
        placeholderTextColor="#64748b"
        autoCapitalize="none"
      />
      <Text style={s.label}>Nouveau mot de passe</Text>
      <TextInput
        style={s.input}
        secureTextEntry
        value={next}
        onChangeText={setNext}
        placeholder="8 caractères minimum"
        placeholderTextColor="#64748b"
        autoCapitalize="none"
      />
      <Text style={s.label}>Confirmer le nouveau mot de passe</Text>
      <TextInput
        style={s.input}
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
        placeholder="••••••••"
        placeholderTextColor="#64748b"
        autoCapitalize="none"
      />
      {error && <Text style={s.error}>{error}</Text>}
      <Pressable onPress={onSubmit} disabled={loading} style={[s.btn, loading && s.btnDisabled]}>
        <Text style={s.btnText}>{loading ? "..." : "Changer le mot de passe"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 24, backgroundColor: "#0f172a", flexGrow: 1 },
  banner: { backgroundColor: "#422006", borderColor: "#854d0e", borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 16 },
  bannerText: { color: "#fcd34d", fontSize: 13 },
  label: { color: "#cbd5e1", fontSize: 13, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: "#1e293b", borderColor: "#334155", borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: "#f1f5f9" },
  error: { color: "#f87171", fontSize: 13, marginTop: 12 },
  btn: { marginTop: 24, backgroundColor: "#3b82f6", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "600" },
});
