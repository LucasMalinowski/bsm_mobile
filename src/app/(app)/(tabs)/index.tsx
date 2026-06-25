import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { useAuth } from "../../../auth/AuthProvider";
import { can } from "../../../auth/permissions";
import { CustomHeader } from "../../../components/ui/CustomHeader";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ticketsApi } from "../../../api/tickets";
import { equipmentApi } from "../../../api/equipment";
import { notificationsApi } from "../../../api/notifications";

export default function DashboardScreen() {
  const { user, logout, activeCompanyId } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const companyId = user?.role === "super_admin" ? activeCompanyId ?? undefined : undefined;

  // Queries
  const { data: ticketsData, isLoading: loadingTickets, refetch: refetchTickets } = useQuery({
    queryKey: ["tickets", "dashboard", companyId],
    queryFn: () => ticketsApi.list({ limit: 5, sort: "created_at", order: "desc", company_id: companyId }),
  });

  const { data: openTicketsData, isLoading: loadingOpenCount, refetch: refetchOpenCount } = useQuery({
    queryKey: ["tickets", "open-count", companyId],
    queryFn: () => ticketsApi.list({ status: "open", limit: 1, company_id: companyId }),
  });

  const { data: calibrationEquipData, isLoading: loadingCalibrations, refetch: refetchCalibrations } = useQuery({
    queryKey: ["equipment", "calibration-count", companyId],
    queryFn: () => equipmentApi.list({ status: "calibration", limit: 5, company_id: companyId }),
  });

  const { data: recentEquipData, isLoading: loadingRecentEquip, refetch: refetchRecentEquip } = useQuery({
    queryKey: ["equipment", "dashboard-recent", companyId],
    queryFn: () => equipmentApi.list({ limit: 5, sort: "updated_at", order: "desc", company_id: companyId }),
  });

  const { data: unreadNotifData, isLoading: loadingNotifs, refetch: refetchNotifs } = useQuery({
    queryKey: ["notifications", "unread-dashboard"],
    queryFn: () => notificationsApi.list(true),
  });

  const isRefreshing = loadingTickets || loadingOpenCount || loadingCalibrations || loadingNotifs || loadingRecentEquip;

  const handleRefresh = async () => {
    await Promise.all([
      refetchTickets(),
      refetchOpenCount(),
      refetchCalibrations(),
      refetchNotifs(),
      refetchRecentEquip(),
    ]);
  };

  const openTicketsCount = openTicketsData?.pagination?.total ?? 0;
  const calibrationCount = calibrationEquipData?.pagination?.total ?? 0;
  const calibrationList = calibrationEquipData?.data ?? [];
  const unreadCount = unreadNotifData?.data?.length ?? 0;
  const recentTickets = ticketsData?.data ?? [];
  const recentEquipment = recentEquipData?.data ?? [];

  return (
    <View style={styles.container}>
      <CustomHeader />
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#6366F1" />
        }
      >
        <Text style={styles.welcomeText}>Painel Operacional</Text>

        {/* Stats Grid */}
        <View style={styles.grid}>
          <TouchableOpacity
            style={styles.gridCol}
            onPress={() => router.push("/(app)/(tabs)/tickets")}
          >
            <Card style={[styles.statCard, { borderLeftColor: "#EF4444", borderLeftWidth: 3 }]}>
              <Ionicons name="alert-circle-outline" size={24} color="#EF4444" />
              <Text style={styles.statNumber}>{openTicketsCount}</Text>
              <Text style={styles.statLabel}>Chamados Abertos</Text>
            </Card>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCol}
            onPress={() => router.push("/(app)/(tabs)/equipment")}
          >
            <Card style={[styles.statCard, { borderLeftColor: "#3B82F6", borderLeftWidth: 3 }]}>
              <Ionicons name="flask-outline" size={24} color="#3B82F6" />
              <Text style={styles.statNumber}>{calibrationCount}</Text>
              <Text style={styles.statLabel}>Em Calibração</Text>
            </Card>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.push("/(app)/(tabs)/notifications")}>
          <Card style={styles.bannerCard}>
            <View style={styles.bannerContent}>
              <Ionicons name="notifications-outline" size={20} color="#FBBF24" />
              <Text style={styles.bannerText}>
                {unreadCount > 0
                  ? `Você tem ${unreadCount} notificações não lidas`
                  : "Nenhuma nova notificação no momento"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#64748B" />
          </Card>
        </TouchableOpacity>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Ações Rápidas</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push("/(app)/equipment/scan")}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: "#312E81" }]}>
              <Ionicons name="qr-code-outline" size={22} color="#818CF8" />
            </View>
            <Text style={styles.actionLabel}>Escanear QR</Text>
          </TouchableOpacity>

          {can(user, "ticket:create") && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => router.push("/(app)/tickets/new")}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: "#064E3B" }]}>
                <Ionicons name="add-circle-outline" size={22} color="#34D399" />
              </View>
              <Text style={styles.actionLabel}>Novo Chamado</Text>
            </TouchableOpacity>
          )}

          {can(user, "equipment:create") && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => router.push("/(app)/equipment/new")}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: "#1E3A8A" }]}>
                <Ionicons name="cube-outline" size={22} color="#60A5FA" />
              </View>
              <Text style={styles.actionLabel}>Equipamento</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push("/(app)/profile")}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: "#1F2937" }]}>
              <Ionicons name="person-outline" size={22} color="#9CA3AF" />
            </View>
            <Text style={styles.actionLabel}>Ver Perfil</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Tickets List */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Chamados Recentes</Text>
          <TouchableOpacity onPress={() => router.push("/(app)/(tabs)/tickets")}>
            <Text style={styles.seeAll}>Ver todos</Text>
          </TouchableOpacity>
        </View>

        {loadingTickets ? (
          <ActivityIndicator size="small" color="#6366F1" style={{ marginVertical: 20 }} />
        ) : recentTickets.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>Nenhum chamado registrado recentemente.</Text>
          </Card>
        ) : (
          recentTickets.map((ticket) => (
            <TouchableOpacity
              key={ticket.id}
              onPress={() => router.push(`/(app)/tickets/${ticket.id}`)}
            >
              <Card style={styles.ticketCard}>
                <View style={styles.ticketHeader}>
                  <Text style={styles.ticketTitle} numberOfLines={1}>
                    {ticket.title}
                  </Text>
                  <Badge type={ticket.status} />
                </View>
                <Text style={styles.ticketDesc} numberOfLines={2}>
                  {ticket.description}
                </Text>
                <View style={styles.ticketMeta}>
                  <View style={styles.metaRow}>
                    <Ionicons name="construct-outline" size={14} color="#64748B" />
                    <Text style={styles.metaText}>
                      {ticket.equipment ? ticket.equipment.name : "Sem Equipamento"}
                    </Text>
                  </View>
                  <Badge type={ticket.priority} style={styles.priorityBadge} />
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}

        {/* Calibrations due */}
        {calibrationCount > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Calibrações Pendentes</Text>
              <TouchableOpacity onPress={() => router.push("/(app)/(tabs)/equipment")}>
                <Text style={styles.seeAll}>Ver todos</Text>
              </TouchableOpacity>
            </View>
            {calibrationList.map((eq) => (
              <TouchableOpacity key={eq.id} onPress={() => router.push(`/(app)/equipment/${eq.id}`)}>
                <Card style={styles.equipCard}>
                  <View style={styles.equipCardLeft}>
                    <View style={styles.equipIcon}>
                      <Ionicons name="flask-outline" size={18} color="#3B82F6" />
                    </View>
                    <View style={styles.equipMeta}>
                      <Text style={styles.equipName} numberOfLines={1}>{eq.name}</Text>
                      <Text style={styles.equipCode}>{eq.internal_code}</Text>
                    </View>
                  </View>
                  <Badge type={eq.status} />
                </Card>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Recent equipment */}
        {recentEquipment.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Equipamentos Recentes</Text>
              <TouchableOpacity onPress={() => router.push("/(app)/(tabs)/equipment")}>
                <Text style={styles.seeAll}>Ver todos</Text>
              </TouchableOpacity>
            </View>
            {loadingRecentEquip ? (
              <ActivityIndicator size="small" color="#6366F1" style={{ marginVertical: 12 }} />
            ) : (
              recentEquipment.map((eq) => (
                <TouchableOpacity key={eq.id} onPress={() => router.push(`/(app)/equipment/${eq.id}`)}>
                  <Card style={styles.equipCard}>
                    <View style={styles.equipCardLeft}>
                      <View style={styles.equipIcon}>
                        <Ionicons name="cube-outline" size={18} color="#64748B" />
                      </View>
                      <View style={styles.equipMeta}>
                        <Text style={styles.equipName} numberOfLines={1}>{eq.name}</Text>
                        <Text style={styles.equipCode}>{eq.internal_code}</Text>
                      </View>
                    </View>
                    <Badge type={eq.status} />
                  </Card>
                </TouchableOpacity>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F0F10",
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F8FAFC",
    marginBottom: 16,
  },
  grid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  gridCol: {
    width: "48%",
  },
  statCard: {
    alignItems: "center",
    paddingVertical: 20,
    marginVertical: 0,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "800",
    color: "#F8FAFC",
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
    fontWeight: "500",
  },
  bannerCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#18181B",
    padding: 14,
    marginBottom: 24,
  },
  bannerContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  bannerText: {
    color: "#E2E8F0",
    fontSize: 13,
    marginLeft: 10,
    fontWeight: "500",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#F8FAFC",
    marginBottom: 12,
  },
  seeAll: {
    color: "#6366F1",
    fontSize: 13,
    fontWeight: "600",
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  actionBtn: {
    alignItems: "center",
    width: "22%",
  },
  actionIconContainer: {
    width: 46,
    height: 46,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  actionLabel: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
  },
  ticketCard: {
    marginBottom: 12,
    backgroundColor: "#151618",
  },
  ticketHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  ticketTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#F8FAFC",
    flex: 1,
    marginRight: 8,
  },
  ticketDesc: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 12,
    lineHeight: 18,
  },
  ticketMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#212225",
    paddingTop: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaText: {
    fontSize: 12,
    color: "#64748B",
    marginLeft: 6,
    fontWeight: "500",
  },
  priorityBadge: {
    transform: [{ scale: 0.9 }],
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyText: {
    color: "#475569",
    fontSize: 14,
  },
  equipCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#151618",
    marginBottom: 10,
    paddingVertical: 12,
  },
  equipCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  equipIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#1C1D20",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  equipMeta: {
    flex: 1,
  },
  equipName: {
    color: "#E2E8F0",
    fontSize: 14,
    fontWeight: "600",
  },
  equipCode: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 2,
  },
});
