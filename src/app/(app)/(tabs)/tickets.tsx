import React, { useState } from "react";
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
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { ticketsApi } from "../../../api/tickets";

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

export default function TicketsListScreen() {
  const { user, activeCompanyId } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const companyId = user?.role === "super_admin" ? activeCompanyId ?? undefined : undefined;

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["tickets", { search, status, priority, companyId }],
    queryFn: () => ticketsApi.list({ search, status: status || undefined, priority: priority || undefined, limit: 30, sort: "updated_at", order: "desc", company_id: companyId }),
  });

  const tickets = data?.data ?? [];

  return (
    <View style={s.container}>
      <CustomHeader />

      {/* Search */}
      <View style={s.searchSection}>
        <View style={s.searchBox}>
          <Ionicons name="search" size={16} color="#64748B" style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Buscar chamados..."
            placeholderTextColor="#64748B"
            value={search}
            onChangeText={(t) => setSearch(t)}
            style={s.searchInput}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color="#64748B" />
            </TouchableOpacity>
          ) : null}
        </View>
        {/* Status filters */}
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
        {/* Priority filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
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
        <View style={s.center}><ActivityIndicator size="large" color="#6366F1" /></View>
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
          <Ionicons name="clipboard-outline" size={48} color="#475569" />
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
              <Card style={s.card}>
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
                        <Ionicons name="cube-outline" size={12} color="#64748B" />
                        <Text style={s.metaText}>{item.equipment.name}</Text>
                      </View>
                    )}
                    {item._count && item._count.comments > 0 && (
                      <View style={s.metaItem}>
                        <Ionicons name="chatbubble-outline" size={12} color="#64748B" />
                        <Text style={s.metaText}>{item._count.comments}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </Card>
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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F0F10" },
  searchSection: { padding: 12, backgroundColor: "#111214", borderBottomWidth: 1, borderBottomColor: "#2E3033" },
  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#151618", borderRadius: 8, borderWidth: 1, borderColor: "#2E3033", height: 40, paddingHorizontal: 12, marginBottom: 10 },
  searchInput: { flex: 1, color: "#F8FAFC", fontSize: 14 },
  filterRow: { gap: 6, paddingBottom: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6, backgroundColor: "#1C1D20", marginRight: 6 },
  chipActive: { backgroundColor: "#6366F1" },
  chipText: { fontSize: 12, color: "#94A3B8", fontWeight: "500" },
  chipTextActive: { color: "#FFFFFF", fontWeight: "600" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  errorText: { color: "#EF4444", fontSize: 14, marginTop: 12, textAlign: "center" },
  emptyText: { color: "#475569", fontSize: 14, marginTop: 12 },
  retryBtn: { marginTop: 16, backgroundColor: "#1C1D20", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: "#2E3033" },
  retryText: { color: "#6366F1", fontWeight: "600" },
  list: { padding: 16, paddingBottom: 88 },
  card: { backgroundColor: "#151618", marginBottom: 12 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  title: { fontSize: 15, fontWeight: "600", color: "#F8FAFC", flex: 1, marginRight: 8 },
  desc: { fontSize: 13, color: "#64748B", marginBottom: 10, lineHeight: 18 },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: "#212225", paddingTop: 8 },
  metaRow: { flexDirection: "row", gap: 12 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, color: "#64748B" },
  fab: { position: "absolute", right: 20, bottom: 20, backgroundColor: "#6366F1", width: 56, height: 56, borderRadius: 28, justifyContent: "center", alignItems: "center", elevation: 5 },
});
