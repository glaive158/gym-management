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
          <Tab.Screen name="Scan" component={ScanScreen} />
          <Tab.Screen name="Abonnement" component={SubscriptionScreen} />
          <Tab.Screen name="Historique" component={HistoryScreen} />
          <Tab.Screen name="Profil" component={ProfileScreen} />
        </Tab.Navigator>
      )}
    </NavigationContainer>
  );
}
