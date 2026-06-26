import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, TextInput, ScrollView } from "react-native";
import { useAuth } from "../../../auth/AuthProvider";
import { can } from "../../../auth/permissions";
import { CustomHeader } from "../../../components/ui/CustomHeader";
import { Badge } from "../../../components/ui/Badge";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { equipmentApi, EquipmentFilters } from "../../../api/equipment";
import { useTheme } from "../../../contexts/ThemeContext";

const STATUS_FILTERS = [
  { label: "Todos", value: "" },
  { label: "Ativo", value: "active" },
  { label: "Manutenção", value: "under_maintenance" },
  { label: "Calibração", value: "calibration" },
  { label: "Inativo", value: "inactive" },
];

const SORT_OPTIONS = [
  { label: "Atualizado", sort: "updated_at", order: "desc" },
  { label: "Nome A-Z", sort: "name", order: "asc" },
  { label: "Nome Z-A", sort: "name", order: "desc" },
  { label: "Código", sort: "internal_code", order: "asc" },
] as const;

type SortOption = (typeof SORT_OPTIONS)[number];

export default function EquipmentListScreen() {
  const { user, activeCompanyId } = useAuth();
  const { colors: c } = useTheme();
  const router = useRouter();
  const s = useMemo(() => makeStyles(c), [c]);
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selectedSort, setSelectedSort] = useState<SortOption>(SORT_OPTIONS[0]);
  const companyId = user?.role === "super_admin" ? activeCompanyId ?? undefined : undefined;

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["equipment", { search, status: selectedStatus, page, sort: selectedSort.sort, order: selectedSort.order, companyId }],
    queryFn: () =>
      equipmentApi.list({
        search,
        status: selectedStatus || undefined,
        page,
        limit: 20,
        sort: selectedSort.sort,
        order: selectedSort.order,
        company_id: companyId,
      }),
  });

  const equipmentList = data?.data ?? [];

  const handleSearchChange = (text: string) => { setSearch(text); setPage(1); };
  const handleStatusChange = (status: string) => { setSelectedStatus(status); setPage(1); };

  return (
    <View style={s.container}>
      <CustomHeader />

      <View style={s.filterBar}>
        <View style={s.searchBox}>
          <Ionicons name="search" size={16} color={c.textMuted} style={s.searchIcon} />
          <TextInput
            placeholder="Buscar por código ou nome..."
            placeholderTextColor={c.textMuted}
            value={search}
            onChangeText={handleSearchChange}
            style={s.searchInput}
            autoCorrect={false}
          />
          {search ? (
            <TouchableOpacity onPress={() => handleSearchChange("")}>
              <Ionicons name="close-circle" size={16} color={c.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {STATUS_FILTERS.map((f) => {
            const isSelected = selectedStatus === f.value;
            return (
              <TouchableOpacity
                key={f.value}
                onPress={() => handleStatusChange(f.value)}
                style={[s.chip, isSelected && s.chipActive]}
              >
                <Text style={[s.chipText, isSelected && s.chipTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.filterRow, { marginTop: 6 }]}>
          <Ionicons name="swap-vertical-outline" size={13} color={c.textMuted} style={{ marginRight: 4, alignSelf: "center" }} />
          {SORT_OPTIONS.map((opt) => {
            const isActive = selectedSort.sort === opt.sort && selectedSort.order === opt.order;
            return (
              <TouchableOpacity
                key={`${opt.sort}-${opt.order}`}
                onPress={() => { setSelectedSort(opt); setPage(1); }}
                style={[s.chip, isActive && s.sortChipActive]}
              >
                <Text style={[s.chipText, isActive && s.sortChipTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={s.center}><ActivityIndicator size="large" color={c.primary} /></View>
      ) : isError ? (
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={48} color="#EF4444" />
          <Text style={s.errorText}>Não foi possível carregar os equipamentos.</Text>
          <TouchableOpacity onPress={() => refetch()} style={s.retryBtn}>
            <Text style={s.retryText}>Tentar Novamente</Text>
          </TouchableOpacity>
        </View>
      ) : equipmentList.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="cube-outline" size={48} color={c.border} />
          <Text style={s.emptyText}>Nenhum equipamento localizado.</Text>
        </View>
      ) : (
        <FlatList
          data={equipmentList}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.listContainer}
          refreshing={isFetching && page === 1}
          onRefresh={refetch}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => router.push(`/(app)/equipment/${item.id}`)}>
              <View style={s.equipmentCard}>
                <View style={s.cardLeft}>
                  <View style={s.cardIcon}>
                    <Ionicons name="cube-outline" size={18} color={c.primary} />
                  </View>
                  <View style={s.cardMeta}>
                    <Text style={s.equipCode}>{item.internal_code}</Text>
                    <Text style={s.equipName} numberOfLines={1}>{item.name}</Text>
                    <View style={s.cardFooter}>
                      {item.category ? (
                        <View style={s.footerRow}>
                          <Ionicons name="folder-open-outline" size={12} color={c.textMuted} />
                          <Text style={s.footerText}>{item.category.name}</Text>
                        </View>
                      ) : null}
                      {item.location ? (
                        <View style={s.footerRow}>
                          <Ionicons name="location-outline" size={12} color={c.textMuted} />
                          <Text style={s.footerText} numberOfLines={1}>{item.location}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>
                <View style={s.cardRight}>
                  <Badge type={item.status} />
                  <Ionicons name="chevron-forward" size={14} color={c.border} style={{ marginTop: 6 }} />
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {can(user, "equipment:create") && (
        <TouchableOpacity style={s.fab} onPress={() => router.push("/(app)/equipment/new")}>
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
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, color: c.text, fontSize: 14, height: "100%" },
    filterRow: { gap: 6 },
    chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 9999, backgroundColor: c.filterChip, marginRight: 6 },
    chipActive: { backgroundColor: c.primary },
    chipText: { fontSize: 12, color: c.filterChipText, fontWeight: "500" },
    chipTextActive: { color: "#ffffff", fontWeight: "600" },
    sortChipActive: { backgroundColor: c.primaryLight, borderWidth: 1, borderColor: c.primaryBorder },
    sortChipTextActive: { color: c.primary, fontWeight: "600" },
    center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
    errorText: { color: "#EF4444", fontSize: 14, fontWeight: "500", marginTop: 12, textAlign: "center" },
    retryBtn: { marginTop: 16, backgroundColor: c.primaryLight, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
    retryText: { color: c.primary, fontWeight: "600", fontSize: 14 },
    emptyText: { color: c.textMuted, fontSize: 14, marginTop: 12 },
    listContainer: { padding: 16, paddingBottom: 88, gap: 10 },
    equipmentCard: {
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
      elevation: 1,
    },
    cardLeft: { flexDirection: "row", alignItems: "center", flex: 1, marginRight: 10 },
    cardIcon: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: c.primaryLight,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
      flexShrink: 0,
    },
    cardMeta: { flex: 1 },
    equipCode: { fontSize: 11, color: c.textMuted, fontWeight: "500", marginBottom: 2 },
    equipName: { fontSize: 14, fontWeight: "600", color: c.text, marginBottom: 6 },
    cardFooter: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
    footerRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    footerText: { fontSize: 11, color: c.textMuted, fontWeight: "500" },
    cardRight: { alignItems: "flex-end", flexShrink: 0 },
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
