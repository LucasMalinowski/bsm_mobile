import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, TextInput, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { CustomHeader } from "../../../components/ui/CustomHeader";
import { Card } from "../../../components/ui/Card";
import { documentsApi } from "../../../api/documents";
import { useAuth } from "../../../auth/AuthProvider";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const MIME_ICONS: Record<string, string> = {
  "application/pdf": "document-text",
  "image/png": "image",
  "image/jpeg": "image",
  "application/vnd.ms-excel": "grid",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "grid",
  "application/msword": "document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
};

const DOC_SORTS = [
  { label: "Recente", sort: "updated_at", order: "desc" },
  { label: "Antigo", sort: "updated_at", order: "asc" },
  { label: "Nome A-Z", sort: "name", order: "asc" },
  { label: "Nome Z-A", sort: "name", order: "desc" },
] as const;

type DocSort = (typeof DOC_SORTS)[number];

export default function DocumentsListScreen() {
  const router = useRouter();
  const { user, activeCompanyId } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedSort, setSelectedSort] = useState<DocSort>(DOC_SORTS[0]);
  const companyId = user?.role === "super_admin" ? activeCompanyId ?? undefined : undefined;

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["documents", { search, sort: selectedSort.sort, order: selectedSort.order, companyId }],
    queryFn: () => documentsApi.list({ search, limit: 30, sort: selectedSort.sort, order: selectedSort.order, company_id: companyId }),
  });

  const docs = data?.data ?? [];

  return (
    <View style={s.container}>
      <CustomHeader />

      <View style={s.searchSection}>
        <View style={s.searchBox}>
          <Ionicons name="search" size={16} color="#64748B" style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Buscar documentos..."
            placeholderTextColor="#64748B"
            value={search}
            onChangeText={setSearch}
            style={s.searchInput}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color="#64748B" />
            </TouchableOpacity>
          ) : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.sortRow}>
          <Ionicons name="swap-vertical-outline" size={13} color="#64748B" style={{ marginRight: 4, alignSelf: "center" }} />
          {DOC_SORTS.map((opt) => {
            const active = selectedSort.sort === opt.sort && selectedSort.order === opt.order;
            return (
              <TouchableOpacity
                key={`${opt.sort}-${opt.order}`}
                onPress={() => setSelectedSort(opt)}
                style={[s.sortChip, active && s.sortChipActive]}
              >
                <Text style={[s.sortChipText, active && s.sortChipTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#6366F1" /></View>
      ) : isError ? (
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={48} color="#EF4444" />
          <Text style={s.errorText}>Erro ao carregar documentos.</Text>
          <TouchableOpacity onPress={() => refetch()} style={s.retryBtn}>
            <Text style={s.retryText}>Tentar Novamente</Text>
          </TouchableOpacity>
        </View>
      ) : docs.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="document-text-outline" size={48} color="#475569" />
          <Text style={s.emptyText}>Nenhum documento encontrado.</Text>
        </View>
      ) : (
        <FlatList
          data={docs}
          keyExtractor={(d) => d.id}
          contentContainerStyle={s.list}
          refreshing={isFetching}
          onRefresh={refetch}
          renderItem={({ item }) => {
            const iconName = MIME_ICONS[item.mime_type] ?? "document-outline";
            return (
              <TouchableOpacity onPress={() => router.push(`/(app)/documents/${item.id}`)}>
                <Card style={s.docCard}>
                  <View style={s.docIcon}>
                    <Ionicons name={iconName as any} size={24} color="#6366F1" />
                  </View>
                  <View style={s.docMeta}>
                    <Text style={s.docName} numberOfLines={2}>{item.name}</Text>
                    {item.description && (
                      <Text style={s.docDesc} numberOfLines={1}>{item.description}</Text>
                    )}
                    <View style={s.docFooter}>
                      <Text style={s.docSize}>{formatBytes(item.file_size)}</Text>
                      <Text style={s.docVersion}>v{item.version}</Text>
                      {item.equipment && (
                        <View style={s.equipTag}>
                          <Ionicons name="cube-outline" size={10} color="#818CF8" />
                          <Text style={s.equipText}>{item.equipment.name}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#475569" />
                </Card>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F0F10" },
  searchSection: { padding: 12, paddingBottom: 10, backgroundColor: "#111214", borderBottomWidth: 1, borderBottomColor: "#2E3033" },
  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#151618", borderRadius: 8, borderWidth: 1, borderColor: "#2E3033", height: 40, paddingHorizontal: 12, marginBottom: 8 },
  searchInput: { flex: 1, color: "#F8FAFC", fontSize: 14 },
  sortRow: { gap: 6, alignItems: "center" },
  sortChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: "#1C1D20", marginRight: 6 },
  sortChipActive: { backgroundColor: "#1A1A2E", borderWidth: 1, borderColor: "#312E81" },
  sortChipText: { fontSize: 11, color: "#64748B", fontWeight: "500" },
  sortChipTextActive: { color: "#818CF8", fontWeight: "700" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  errorText: { color: "#EF4444", fontSize: 14, marginTop: 12, textAlign: "center" },
  emptyText: { color: "#475569", fontSize: 14, marginTop: 12 },
  retryBtn: { marginTop: 16, backgroundColor: "#1C1D20", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: "#2E3033" },
  retryText: { color: "#6366F1", fontWeight: "600" },
  list: { padding: 16, paddingBottom: 32 },
  docCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#151618", marginBottom: 10, padding: 14 },
  docIcon: { width: 44, height: 44, backgroundColor: "#1A1A2E", borderRadius: 10, justifyContent: "center", alignItems: "center", marginRight: 14 },
  docMeta: { flex: 1, marginRight: 8 },
  docName: { fontSize: 14, fontWeight: "600", color: "#F8FAFC", marginBottom: 2 },
  docDesc: { fontSize: 12, color: "#64748B", marginBottom: 4 },
  docFooter: { flexDirection: "row", gap: 10, alignItems: "center" },
  docSize: { fontSize: 11, color: "#475569" },
  docVersion: { fontSize: 11, color: "#475569", backgroundColor: "#1C1D20", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  equipTag: { flexDirection: "row", alignItems: "center", gap: 4 },
  equipText: { fontSize: 11, color: "#818CF8" },
});
