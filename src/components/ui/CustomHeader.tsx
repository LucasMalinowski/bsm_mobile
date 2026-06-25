import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import { useAuth } from "../../auth/AuthProvider";
import { Badge } from "./Badge";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { notificationsApi } from "../../api/notifications";
import { companyApi } from "../../api/company";

export const CustomHeader: React.FC = () => {
  const { user, activeCompanyId } = useAuth();
  const router = useRouter();

  // Load notifications to display unread count live
  const { data: notifData } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => notificationsApi.list(true),
    enabled: !!user,
    refetchInterval: 15000, // Poll every 15s to keep count fresh
  });

  const { data: activeCompanyData } = useQuery({
    queryKey: ["companies", activeCompanyId],
    queryFn: () => companyApi.get(activeCompanyId!),
    enabled: !!activeCompanyId && user?.role === "super_admin",
  });

  const unreadCount = notifData?.data?.length || 0;

  if (!user) return null;

  return (
    <View>
    <View style={styles.header}>
      <View style={styles.userInfo}>
        {user.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitials}>
              {user.name.slice(0, 2).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.meta}>
          <Text style={styles.name} numberOfLines={1}>
            {user.name}
          </Text>
          <Badge type={user.role} style={styles.roleBadge} />
        </View>
      </View>

      <TouchableOpacity
        onPress={() => router.push("/(app)/(tabs)/notifications")}
        style={styles.bellContainer}
      >
        <Ionicons name="notifications-outline" size={24} color="#F8FAFC" />
        {unreadCount > 0 && (
          <View style={styles.badgeCount}>
            <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
    {user.impersonating && (
      <View style={styles.impersonationBanner}>
        <Ionicons name="warning-outline" size={14} color="#FDE68A" />
        <Text style={styles.impersonationText}>Sessão de impersonação ativa</Text>
      </View>
    )}
    {user.role === "super_admin" && (
      <TouchableOpacity
        style={styles.activeCompanyBanner}
        onPress={() => router.push("/(app)/select-company" as any)}
      >
        <Ionicons name="business-outline" size={14} color="#A5B4FC" />
        <Text style={styles.activeCompanyText}>
          {activeCompanyData?.data?.name
            ? `Operando em: ${activeCompanyData.data.name}`
            : "Nenhuma empresa selecionada — toque para escolher"}
        </Text>
      </TouchableOpacity>
    )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    height: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#111214",
    borderBottomWidth: 1,
    borderBottomColor: "#2E3033",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 16,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1F2022",
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  meta: {
    marginLeft: 12,
    justifyContent: "center",
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F8FAFC",
  },
  roleBadge: {
    marginTop: 2,
    transform: [{ scale: 0.85 }],
    marginLeft: -4,
  },
  bellContainer: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
    backgroundColor: "#1C1D20",
  },
  badgeCount: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "#EF4444",
    borderRadius: 9,
    width: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#1C1D20",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "bold",
  },
  impersonationBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#78350F",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#92400E",
  },
  impersonationText: {
    color: "#FDE68A",
    fontSize: 12,
    fontWeight: "600",
  },
  activeCompanyBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#312E81",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#4338CA",
  },
  activeCompanyText: {
    color: "#A5B4FC",
    fontSize: 12,
    fontWeight: "600",
  },
});
