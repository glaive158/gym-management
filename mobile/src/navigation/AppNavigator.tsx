import React from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { LoginScreen } from "../screens/LoginScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { ScanScreen } from "../screens/ScanScreen";
import { SubscriptionScreen } from "../screens/SubscriptionScreen";
import { HistoryScreen } from "../screens/HistoryScreen";
import { ChangePasswordScreen } from "../screens/ChangePasswordScreen";
import { FitnessScreen } from "../screens/FitnessScreen";

const Tab = createBottomTabNavigator();

export function AppNavigator() {
  const { token, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: "#0f172a" }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }
  return (
    <NavigationContainer>
      {!token ? (
        <LoginScreen />
      ) : (
        <Tab.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: "#1e293b" },
            headerTitleStyle: { color: "#f1f5f9" },
            tabBarStyle: { backgroundColor: "#1e293b", borderTopColor: "#334155" },
            tabBarActiveTintColor: "#3b82f6",
            tabBarInactiveTintColor: "#94a3b8",
          }}
        >
          <Tab.Screen
            name="Scan"
            component={ScanScreen}
            options={{ tabBarIcon: ({ color, size }) => <Ionicons name="qr-code-outline" size={size} color={color} /> }}
          />
          <Tab.Screen
            name="Abonnement"
            component={SubscriptionScreen}
            options={{ tabBarIcon: ({ color, size }) => <Ionicons name="card-outline" size={size} color={color} /> }}
          />
          <Tab.Screen
            name="Forme"
            component={FitnessScreen}
            options={{ tabBarIcon: ({ color, size }) => <Ionicons name="barbell-outline" size={size} color={color} /> }}
          />
          <Tab.Screen
            name="Historique"
            component={HistoryScreen}
            options={{ tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" size={size} color={color} /> }}
          />
          <Tab.Screen
            name="Profil"
            component={ProfileScreen}
            options={{ tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} /> }}
          />
          <Tab.Screen
            name="Mot de passe"
            component={ChangePasswordScreen}
            options={{ tabBarIcon: ({ color, size }) => <Ionicons name="lock-closed-outline" size={size} color={color} /> }}
          />
        </Tab.Navigator>
      )}
    </NavigationContainer>
  );
}
