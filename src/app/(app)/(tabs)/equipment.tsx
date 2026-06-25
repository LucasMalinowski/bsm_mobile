import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, TextInput, ScrollView } from "react-native";
import { useAuth } from "../../../auth/AuthProvider";
import { can } from "../../../auth/permissions";
import { CustomHeader } from "../../../components/ui/CustomHeader";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { equipmentApi, EquipmentFilters } from "../../../api/equipment";

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
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selectedSort, setSelectedSort] = useState<SortOption>(SORT_OPTIONS[0]);
  const companyId = user?.role === "super_admin" ? activeCompanyId ?? undefined : undefined;

  // Queries
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
  const pagination = data?.pagination;

  const handleSearchChange = (text: string) => {
    setSearch(text);
    setPage(1);
  };

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
    setPage(1);
  };

  return (
    <View style={styles.container}>
      <CustomHeader />
      
      {/* Search and Filters Bar */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#64748B" style={styles.searchIcon} />
          <TextInput
            placeholder="Buscar por código ou nome..."
            placeholderTextColor="#64748B"
            value={search}
            onChangeText={handleSearchChange}
            style={styles.searchInput}
            autoCorrect={false}
          />
          {search ? (
            <TouchableOpacity onPress={() => handleSearchChange("")}>
              <Ionicons name="close-circle" size={18} color="#64748B" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Horizontal Status Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollView}
        >
          {STATUS_FILTERS.map((f) => {
            const isSelected = selectedStatus === f.value;
            return (
              <TouchableOpacity
                key={f.value}
                onPress={() => handleStatusChange(f.value)}
                style={[
                  styles.filterTab,
                  isSelected ? styles.filterTabActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.filterTabLabel,
                    isSelected ? styles.filterTabLabelActive : null,
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Sort row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.filterScrollView, { marginTop: 8 }]}
        >
          <Ionicons name="swap-vertical-outline" size={14} color="#64748B" style={{ marginRight: 4, alignSelf: "center" }} />
          {SORT_OPTIONS.map((opt) => {
            const isActive = selectedSort.sort === opt.sort && selectedSort.order === opt.order;
            return (
              <TouchableOpacity
                key={`${opt.sort}-${opt.order}`}
                onPress={() => { setSelectedSort(opt); setPage(1); }}
                style={[styles.filterTab, isActive && styles.sortTabActive]}
              >
                <Text style={[styles.filterTabLabel, isActive && styles.sortTabLabelActive]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      ) : isError ? (
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>Não foi possível carregar os equipamentos.</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Tentar Novamente</Text>
          </TouchableOpacity>
        </View>
      ) : equipmentList.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="cube-outline" size={48} color="#475569" />
          <Text style={styles.emptyText}>Nenhum equipamento localizado.</Text>
        </View>
      ) : (
        <FlatList
          data={equipmentList}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshing={isFetching && page === 1}
          onRefresh={refetch}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => router.push(`/(app)/equipment/${item.id}`)}>
              <Card style={styles.equipmentCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.codeContainer}>
                    <Text style={styles.internalCode}>{item.internal_code}</Text>
                    <Text style={styles.brandModel}>
                      {item.brand ? `${item.brand} ` : ""}{item.model ? `(${item.model})` : ""}
                    </Text>
                  </View>
                  <Badge type={item.status} />
                </View>

                <Text style={styles.name}>{item.name}</Text>
                
                <View style={styles.cardFooter}>
                  <View style={styles.footerRow}>
                    <Ionicons name="folder-open-outline" size={14} color="#64748B" />
                    <Text style={styles.footerText}>
                      {item.category ? item.category.name : "Sem categoria"}
                    </Text>
                  </View>
                  {item.location ? (
                    <View style={styles.footerRow}>
                      <Ionicons name="location-outline" size={14} color="#64748B" />
                      <Text style={styles.footerText} numberOfLines={1}>
                        {item.location}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </Card>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Floating Action Button */}
      {can(user, "equipment:create") && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push("/(app)/equipment/new")}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F0F10",
  },
  searchBarContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2E3033",
    backgroundColor: "#111214",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#151618",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2E3033",
    height: 40,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: "#F8FAFC",
    fontSize: 14,
    height: "100%",
  },
  filterScrollView: {
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#1C1D20",
    marginRight: 6,
  },
  filterTabActive: {
    backgroundColor: "#6366F1",
  },
  filterTabLabel: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "500",
  },
  filterTabLabelActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  sortTabActive: {
    backgroundColor: "#1A1A2E",
    borderWidth: 1,
    borderColor: "#312E81",
  },
  sortTabLabelActive: {
    color: "#818CF8",
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 15,
    fontWeight: "500",
    marginTop: 12,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 16,
    backgroundColor: "#1C1D20",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2E3033",
  },
  retryText: {
    color: "#6366F1",
    fontWeight: "600",
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyText: {
    color: "#475569",
    fontSize: 14,
    marginTop: 12,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 88,
  },
  equipmentCard: {
    marginBottom: 12,
    backgroundColor: "#151618",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  codeContainer: {
    flex: 1,
    marginRight: 12,
  },
  internalCode: {
    fontSize: 16,
    fontWeight: "700",
    color: "#F8FAFC",
  },
  brandModel: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },
  name: {
    fontSize: 14,
    color: "#E2E8F0",
    fontWeight: "500",
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: "row",
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: "#212225",
    paddingTop: 8,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  footerText: {
    fontSize: 12,
    color: "#64748B",
    marginLeft: 6,
    fontWeight: "500",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    backgroundColor: "#6366F1",
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
});
