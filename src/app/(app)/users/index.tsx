import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { usersApi } from "../../../api/users";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { useAuth } from "../../../auth/AuthProvider";
import { can } from "../../../auth/permissions";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Administrador",
  employee: "Funcionário",
};

export default function UsersListScreen() {
  const router = useRouter();
  const { user, activeCompanyId } = useAuth();
  const [search, setSearch] = useState("");
  const companyId = user?.role === "super_admin" ? activeCompanyId ?? undefined : undefined;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["users", companyId],
    queryFn: () => usersApi.list({ company_id: companyId }),
  });

  const users = (data ?? []).filter((u) =>
    search === "" ||
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backAction}>
          <Ionicons name="arrow-back" size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Usuários</Text>
        {can(user, "user:invite") && (
          <TouchableOpacity onPress={() => router.push("/(app)/profile")} style={s.headerBtn}>
            <Ionicons name="person-add-outline" size={22} color="#818CF8" />
          </TouchableOpacity>
        )}
      </View>

      <View style={s.searchRow}>
        <Ionicons name="search-outline" size={16} color="#64748B" style={s.searchIcon} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nome ou e-mail..."
          placeholderTextColor="#5E636E"
          style={s.searchInput}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={16} color="#475569" />
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#6366F1" /></View>
      ) : isError ? (
        <View style={s.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={s.errorText}>Erro ao carregar usuários.</Text>
          <TouchableOpacity onPress={() => refetch()} style={s.retryBtn}>
            <Text style={s.retryText}>Tentar Novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => router.push(`/(app)/users/${item.id}` as any)} activeOpacity={0.8}>
              <Card style={{ ...s.userCard, ...(item.is_active ? {} : s.inactiveCard) }}>
                <View style={s.userAvatar}>
                  <Text style={s.userAvatarText}>{item.name.slice(0, 2).toUpperCase()}</Text>
                </View>
                <View style={s.userMeta}>
                  <View style={s.userTop}>
                    <Text style={[s.userName, !item.is_active && s.inactiveText]}>{item.name}</Text>
                    {!item.is_active && (
                      <View style={s.inactiveBadge}>
                        <Text style={s.inactiveBadgeText}>Inativo</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.userEmail}>{item.email}</Text>
                  <Text style={s.userRole}>{ROLE_LABELS[item.role] ?? item.role}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#475569" />
              </Card>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={s.emptyBox}>
              <Ionicons name="people-outline" size={48} color="#475569" />
              <Text style={s.emptyText}>Nenhum usuário encontrado.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F0F10" },
  header: { height: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#111214", borderBottomWidth: 1, borderBottomColor: "#2E3033", paddingHorizontal: 16, paddingTop: 12 },
  backAction: { padding: 4 },
  headerTitle: { color: "#F8FAFC", fontSize: 16, fontWeight: "700", flex: 1, marginLeft: 12 },
  headerBtn: { padding: 6 },
  searchRow: { flexDirection: "row", alignItems: "center", margin: 12, backgroundColor: "#111214", borderRadius: 10, borderWidth: 1, borderColor: "#2E3033", paddingHorizontal: 12 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 44, color: "#F8FAFC", fontSize: 14 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  errorText: { color: "#EF4444", fontSize: 14, marginTop: 12, textAlign: "center" },
  retryBtn: { marginTop: 16, backgroundColor: "#6366F1", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: "#FFFFFF", fontWeight: "600" },
  list: { padding: 12, paddingBottom: 32 },
  userCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#151618", marginBottom: 10 },
  inactiveCard: { opacity: 0.6 },
  userAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#1A1A2E", justifyContent: "center", alignItems: "center", marginRight: 12 },
  userAvatarText: { color: "#818CF8", fontSize: 14, fontWeight: "700" },
  userMeta: { flex: 1 },
  userTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  userName: { color: "#E2E8F0", fontSize: 14, fontWeight: "700" },
  inactiveText: { color: "#64748B" },
  inactiveBadge: { backgroundColor: "#1C1D20", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: "#2E3033" },
  inactiveBadgeText: { color: "#64748B", fontSize: 10, fontWeight: "600" },
  userEmail: { color: "#64748B", fontSize: 12 },
  userRole: { color: "#475569", fontSize: 11, marginTop: 2 },
  emptyBox: { alignItems: "center", paddingVertical: 48 },
  emptyText: { color: "#475569", fontSize: 14, marginTop: 12 },
});
