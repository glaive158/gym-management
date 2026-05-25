import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { useAuth } from "../context/AuthContext";

export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur";
      Alert.alert("Connexion échouée", msg);
    }
    setLoading(false);
  }

  return (
    <View style={s.wrap}>
      <Text style={s.title}>Gym Management</Text>
      <Text style={s.sub}>Connectez-vous pour accéder à votre salle</Text>
      <TextInput
        placeholder="Email"
        placeholderTextColor="#64748b"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={s.input}
      />
      <TextInput
        placeholder="Mot de passe"
        placeholderTextColor="#64748b"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={s.input}
      />
      <Pressable onPress={submit} disabled={loading} style={s.button}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Se connecter</Text>}
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 24, justifyContent: "center", backgroundColor: "#0f172a" },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 6, color: "#f1f5f9", textAlign: "center" },
  sub: { fontSize: 14, color: "#94a3b8", marginBottom: 28, textAlign: "center" },
  input: {
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#1e293b",
    color: "#f1f5f9",
    padding: 14,
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 16,
  },
  button: { backgroundColor: "#2563eb", padding: 14, borderRadius: 8, marginTop: 8, alignItems: "center" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
