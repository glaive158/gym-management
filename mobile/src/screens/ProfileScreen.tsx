import React from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useAuth } from "../context/AuthContext";

export function ProfileScreen() {
  const { user, logout } = useAuth();
  return (
    <View style={s.wrap}>
      {user?.avatar ? (
        <Image source={{ uri: user.avatar }} style={s.avatar} />
      ) : (
        <View style={[s.avatar, s.avatarPlaceholder]}>
          <Text style={s.initials}>{user?.name?.[0] ?? "?"}</Text>
        </View>
      )}
      <Text style={s.name}>{user?.name}</Text>
      <Text style={s.email}>{user?.email}</Text>
      <Pressable onPress={logout} style={s.logoutBtn}>
        <Text style={s.logoutText}>Déconnexion</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 24, alignItems: "center", justifyContent: "center", backgroundColor: "#0f172a" },
  avatar: { width: 96, height: 96, borderRadius: 48, marginBottom: 16 },
  avatarPlaceholder: { backgroundColor: "#475569", alignItems: "center", justifyContent: "center" },
  initials: { color: "#f1f5f9", fontSize: 36, fontWeight: "700" },
  name: { fontSize: 20, fontWeight: "600", color: "#f1f5f9" },
  email: { fontSize: 14, color: "#94a3b8", marginTop: 4 },
  logoutBtn: { marginTop: 24, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 8, backgroundColor: "#ef4444" },
  logoutText: { color: "#fff", fontWeight: "600" },
});
