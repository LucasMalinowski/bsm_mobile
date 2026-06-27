import React from "react";
import { Stack } from "expo-router";
import { useAuth } from "../../auth/AuthProvider";

export default function AppLayout() {
  const { user } = useAuth();

  // If user is null, the root layout protector is redirecting.
  // We return null to prevent screen flashing.
  if (!user) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="equipment/[id]" />
      <Stack.Screen name="equipment/new" />
      <Stack.Screen name="equipment/edit/[id]" />
      <Stack.Screen name="equipment/scan" />
      <Stack.Screen name="tickets/[id]" />
      <Stack.Screen name="tickets/new" />
      <Stack.Screen name="documents/[id]" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="notification-preferences" />
      <Stack.Screen name="company-settings" />
      <Stack.Screen name="users/index" />
      <Stack.Screen name="users/[id]" />
    </Stack>
  );
}
