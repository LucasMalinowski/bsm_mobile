import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, TextInput, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../auth/AuthProvider";
import { can } from "../../../auth/permissions";
import { CustomHeader } from "../../../components/ui/CustomHeader";
import { Badge } from "../../../components/ui/Badge";
import { ticketsApi } from "../../../api/tickets";
import { useTheme } from "../../../contexts/ThemeContext";

const STATUS_FILTERS = [
  { label: "Todos", value: "" },
  { label: "Abertos", value: "open" },
  { label: "Em Andamento", value: "in_progress" },
  { label: "Pendentes", value: "waiting" },
  { label: "Resolvidos", value: "resolved" },
  { label: "Fechados", value: "closed" },
];

const PRIORITY_FILTERS = [
  { label: "Todas", value: "" },
  { label: "Crítica", value: "critical" },
  { label: "Alta", value: "high" },
  { label: "Média", value: "medium" },
  { label: "Baixa", value: "low" },
];

const PRIORITY_COLORS: Record<string, string> = {
  low: "#9ca3af",
  medium: "#3b82f6",
  high: "#f59e0b",
  critical: "#ef4444",
};

export default function TicketsListScreen() {
  const { user, activeCompanyId } = useAuth();
  const { colors: c } = useTheme();
  const router = useRouter();
  const s = useMemo(() => makeStyles(c), [c]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const companyId = user?.role === "super_admin" ? activeCompanyId ?? undefined : undefined;

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["tickets", { search, status, priority, companyId }],
    queryFn: () => ticketsApi.list({
      search,
      status: status || undefined,
      priority: priority || undefined,
      limit: 30,
      sort: "updated_at",
      order: "desc",
      company_id: companyId,
    }),
  });

  const tickets = data?.data ?? [];

  return (
    <View style={s.container}>
      <CustomHeader />

      <View style={s.filterBar}>
        <View style={s.searchBox}>
          <Ionicons name="search" size={16} color={c.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Buscar chamados..."
            placeholderTextColor={c.textMuted}
            value={search}
            onChangeText={(t) => setSearch(t)}
            style={s.searchInput}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color={c.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {STATUS_FILTERS.map((f) => (
            <TouchableOpacity
              key={f.value}
              onPress={() => setStatus(f.value)}
              style={[s.chip, status === f.value && s.chipActive]}
            >
              <Text style={[s.chipText, status === f.value && s.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.filterRow, { marginTop: 6 }]}>
          {PRIORITY_FILTERS.map((f) => (
            <TouchableOpacity
              key={f.value}
              onPress={() => setPriority(f.value)}
              style={[s.chip, priority === f.value && s.chipActive]}
            >
              <Text style={[s.chipText, priority === f.value && s.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={s.center}><ActivityIndicator size="large" color={c.primary} /></View>
      ) : isError ? (
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={48} color="#EF4444" />
          <Text style={s.errorText}>Erro ao carregar chamados.</Text>
          <TouchableOpacity onPress={() => refetch()} style={s.retryBtn}>
            <Text style={s.retryText}>Tentar Novamente</Text>
          </TouchableOpacity>
        </View>
      ) : tickets.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="clipboard-outline" size={48} color={c.border} />
          <Text style={s.emptyText}>Nenhum chamado encontrado.</Text>
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(t) => t.id}
          contentContainerStyle={s.list}
          refreshing={isFetching}
          onRefresh={refetch}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => router.push(`/(app)/tickets/${item.id}`)}>
              <View style={s.card}>
                <View style={[s.priorityBar, { backgroundColor: PRIORITY_COLORS[item.priority] ?? "#9ca3af" }]} />
                <View style={s.cardContent}>
                  <View style={s.cardTop}>
                    <Text style={s.title} numberOfLines={1}>{item.title}</Text>
                    <Badge type={item.status} />
                  </View>
                  <Text style={s.desc} numberOfLines={2}>{item.description}</Text>
                  <View style={s.cardBottom}>
                    <Badge type={item.priority} />
                    <View style={s.metaRow}>
                      {item.equipment && (
                        <View style={s.metaItem}>
                          <Ionicons name="cube-outline" size={12} color={c.textMuted} />
                          <Text style={s.metaText}>{item.equipment.name}</Text>
                        </View>
                      )}
                      {item._count && item._count.comments > 0 && (
                        <View style={s.metaItem}>
                          <Ionicons name="chatbubble-outline" size={12} color={c.textMuted} />
                          <Text style={s.metaText}>{item._count.comments}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {can(user, "ticket:create") && (
        <TouchableOpacity style={s.fab} onPress={() => router.push("/(app)/tickets/new")}>
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

function makeStyles(c: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    filterBar: { padding: 12, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border },
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.searchBg,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.searchBorder,
      height: 40,
      paddingHorizontal: 12,
      marginBottom: 10,
    },
    searchInput: { flex: 1, color: c.text, fontSize: 14 },
    filterRow: { gap: 6 },
    chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 9999, backgroundColor: c.filterChip, marginRight: 6 },
    chipActive: { backgroundColor: c.primary },
    chipText: { fontSize: 12, color: c.filterChipText, fontWeight: "500" },
    chipTextActive: { color: "#ffffff", fontWeight: "600" },
    center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
    errorText: { color: "#EF4444", fontSize: 14, marginTop: 12, textAlign: "center" },
    emptyText: { color: c.textMuted, fontSize: 14, marginTop: 12 },
    retryBtn: { marginTop: 16, backgroundColor: c.primaryLight, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
    retryText: { color: c.primary, fontWeight: "600" },
    list: { padding: 16, paddingBottom: 88, gap: 10 },
    card: {
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      overflow: "hidden",
      flexDirection: "row",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
      elevation: 1,
    },
    priorityBar: { width: 4, alignSelf: "stretch" },
    cardContent: { flex: 1, padding: 12 },
    cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
    title: { fontSize: 14, fontWeight: "600", color: c.text, flex: 1, marginRight: 8 },
    desc: { fontSize: 12, color: c.textSub, marginBottom: 10, lineHeight: 17 },
    cardBottom: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: c.divider,
      paddingTop: 8,
    },
    metaRow: { flexDirection: "row", gap: 10 },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    metaText: { fontSize: 11, color: c.textMuted },
    fab: {
      position: "absolute",
      right: 20,
      bottom: 20,
      backgroundColor: c.primary,
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 6,
      elevation: 6,
    },
  });
}
