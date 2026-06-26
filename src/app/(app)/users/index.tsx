import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { usersApi } from "../../../api/users";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { useAuth } from "../../../auth/AuthProvider";
import { can } from "../../../auth/permissions";
import { useTheme } from "../../../contexts/ThemeContext";
import type { Colors } from "../../../constants/colors";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin", admin: "Administrador", employee: "Funcionário",
};

export default function UsersListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, activeCompanyId } = useAuth();
  const { colors: c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const [search, setSearch] = useState("");
  const companyId = user?.role === "super_admin" ? activeCompanyId ?? undefined : undefined;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["users", companyId],
    queryFn: () => usersApi.list({ company_id: companyId }),
  });

  const users = (data ?? []).filter((u) =>
    search === "" || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: 12 + insets.top, minHeight: 64 + insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backAction}>
          <Ionicons name="arrow-back" size={24} color={c.headerText} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Usuários</Text>
        {can(user, "user:invite") && (
          <TouchableOpacity onPress={() => router.push("/(app)/profile")} style={s.headerBtn}>
            <Ionicons name="person-add-outline" size={22} color={c.headerText} />
          </TouchableOpacity>
        )}
      </View>

      <View style={s.searchRow}>
        <Ionicons name="search-outline" size={16} color={c.textMuted} style={s.searchIcon} />
        <TextInput value={search} onChangeText={setSearch} placeholder="Buscar por nome ou e-mail..." placeholderTextColor={c.textMuted} style={s.searchInput} />
        {search.length > 0 && <TouchableOpacity onPress={() => setSearch("")}><Ionicons name="close-circle" size={16} color={c.textMuted} /></TouchableOpacity>}
      </View>

      {isLoading ? (
        <View style={s.center}><ActivityIndicator size="large" color={c.primary} /></View>
      ) : isError ? (
        <View style={s.center}>
          <Ionicons name="alert-circle-outline" size={48} color={c.error} />
          <Text style={s.errorText}>Erro ao carregar usuários.</Text>
          <TouchableOpacity onPress={() => refetch()} style={s.retryBtn}><Text style={s.retryText}>Tentar Novamente</Text></TouchableOpacity>
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
                    {!item.is_active && <View style={s.inactiveBadge}><Text style={s.inactiveBadgeText}>Inativo</Text></View>}
                  </View>
                  <Text style={s.userEmail}>{item.email}</Text>
                  <Text style={s.userRole}>{ROLE_LABELS[item.role] ?? item.role}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
              </Card>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={s.emptyBox}>
              <Ionicons name="people-outline" size={48} color={c.textMuted} />
              <Text style={s.emptyText}>Nenhum usuário encontrado.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: c.header, borderBottomWidth: 1, borderBottomColor: c.border, paddingHorizontal: 16, paddingBottom: 12 },
    backAction: { padding: 4 },
    headerTitle: { color: c.headerText, fontSize: 16, fontWeight: "700", flex: 1, marginLeft: 12 },
    headerBtn: { padding: 6 },
    searchRow: { flexDirection: "row", alignItems: "center", margin: 12, backgroundColor: c.surface, borderRadius: 10, borderWidth: 1, borderColor: c.border, paddingHorizontal: 12 },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, height: 44, color: c.text, fontSize: 14 },
    center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
    errorText: { color: c.error, fontSize: 14, marginTop: 12, textAlign: "center" },
    retryBtn: { marginTop: 16, backgroundColor: c.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
    retryText: { color: "#FFFFFF", fontWeight: "600" },
    list: { padding: 12, paddingBottom: 32 },
    userCard: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
    inactiveCard: { opacity: 0.6 },
    userAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.primaryLight, justifyContent: "center", alignItems: "center", marginRight: 12 },
    userAvatarText: { color: c.primary, fontSize: 14, fontWeight: "700" },
    userMeta: { flex: 1 },
    userTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
    userName: { color: c.text, fontSize: 14, fontWeight: "700" },
    inactiveText: { color: c.textMuted },
    inactiveBadge: { backgroundColor: c.surface2, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: c.border },
    inactiveBadgeText: { color: c.textMuted, fontSize: 10, fontWeight: "600" },
    userEmail: { color: c.textMuted, fontSize: 12 },
    userRole: { color: c.textMuted, fontSize: 11, marginTop: 2 },
    emptyBox: { alignItems: "center", paddingVertical: 48 },
    emptyText: { color: c.textMuted, fontSize: 14, marginTop: 12 },
  });
}
