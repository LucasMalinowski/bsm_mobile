import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { useAuth } from "../../../auth/AuthProvider";
import { can } from "../../../auth/permissions";
import { Badge } from "../../../components/ui/Badge";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ticketsApi } from "../../../api/tickets";
import { equipmentApi } from "../../../api/equipment";
import { notificationsApi } from "../../../api/notifications";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../../contexts/ThemeContext";

function getGreeting(name: string) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  return `${greeting}, ${name.split(" ")[0]} 👋`;
}

function formatDate() {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function DashboardScreen() {
  const { user, activeCompanyId } = useAuth();
  const { colors: c } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => makeStyles(c), [c]);
  const companyId = user?.role === "super_admin" ? activeCompanyId ?? undefined : undefined;

  const { data: ticketsData, isLoading: loadingTickets, refetch: refetchTickets } = useQuery({
    queryKey: ["tickets", "dashboard", companyId],
    queryFn: () => ticketsApi.list({ limit: 5, sort: "created_at", order: "desc", company_id: companyId }),
  });

  const { data: openTicketsData, refetch: refetchOpenCount } = useQuery({
    queryKey: ["tickets", "open-count", companyId],
    queryFn: () => ticketsApi.list({ status: "open", limit: 1, company_id: companyId }),
  });

  const { data: inProgressTicketsData, refetch: refetchInProgress } = useQuery({
    queryKey: ["tickets", "inprogress-count", companyId],
    queryFn: () => ticketsApi.list({ status: "in_progress", limit: 1, company_id: companyId }),
  });

  const { data: resolvedTicketsData, refetch: refetchResolved } = useQuery({
    queryKey: ["tickets", "resolved-count", companyId],
    queryFn: () => ticketsApi.list({ status: "resolved", limit: 1, company_id: companyId }),
  });

  const { data: allEquipmentData, refetch: refetchAllEquip } = useQuery({
    queryKey: ["equipment", "total-count", companyId],
    queryFn: () => equipmentApi.list({ limit: 1, company_id: companyId }),
  });

  const { data: recentEquipData, isLoading: loadingRecentEquip, refetch: refetchRecentEquip } = useQuery({
    queryKey: ["equipment", "dashboard-recent", companyId],
    queryFn: () => equipmentApi.list({ limit: 6, sort: "updated_at", order: "desc", company_id: companyId }),
  });

  const { data: calibrationEquipData, refetch: refetchCalibrations } = useQuery({
    queryKey: ["equipment", "calibration-count", companyId],
    queryFn: () => equipmentApi.list({ status: "calibration", limit: 5, company_id: companyId }),
  });

  const { data: unreadNotifData, isLoading: loadingNotifs, refetch: refetchNotifs } = useQuery({
    queryKey: ["notifications", "unread-dashboard"],
    queryFn: () => notificationsApi.list(true),
  });

  const isRefreshing = loadingTickets || loadingRecentEquip || loadingNotifs;

  const handleRefresh = async () => {
    await Promise.all([
      refetchTickets(),
      refetchOpenCount(),
      refetchInProgress(),
      refetchResolved(),
      refetchAllEquip(),
      refetchRecentEquip(),
      refetchCalibrations(),
      refetchNotifs(),
    ]);
  };

  const openTicketsCount = openTicketsData?.pagination?.total ?? 0;
  const inProgressCount = inProgressTicketsData?.pagination?.total ?? 0;
  const resolvedCount = resolvedTicketsData?.pagination?.total ?? 0;
  const totalEquipment = allEquipmentData?.pagination?.total ?? 0;
  const calibrationList = calibrationEquipData?.data ?? [];
  const calibrationCount = calibrationEquipData?.pagination?.total ?? 0;
  const unreadCount = unreadNotifData?.data?.length ?? 0;
  const recentTickets = ticketsData?.data ?? [];
  const recentEquipment = recentEquipData?.data ?? [];

  const STAT_CARDS = [
    {
      label: "Equipamentos",
      value: totalEquipment,
      iconBg: "#eff6ff",
      icon: <Ionicons name="cube-outline" size={16} color="#2563eb" />,
      onPress: () => router.push("/(app)/(tabs)/equipment"),
    },
    {
      label: "Chamados Abertos",
      value: openTicketsCount,
      iconBg: "#fff7ed",
      icon: <Ionicons name="ticket-outline" size={16} color="#ea580c" />,
      onPress: () => router.push("/(app)/(tabs)/tickets"),
    },
    {
      label: "Em Andamento",
      value: inProgressCount,
      iconBg: "#fefce8",
      icon: <Ionicons name="flash-outline" size={16} color="#ca8a04" />,
      onPress: () => router.push("/(app)/(tabs)/tickets"),
    },
    {
      label: "Resolvidos",
      value: resolvedCount,
      iconBg: "#f0fdf4",
      icon: <Ionicons name="checkmark-circle-outline" size={16} color="#16a34a" />,
      onPress: () => router.push("/(app)/(tabs)/tickets"),
    },
  ];

  const PRIORITY_COLORS: Record<string, string> = {
    low: "#9ca3af",
    medium: "#3b82f6",
    high: "#f59e0b",
    critical: "#ef4444",
  };

  return (
    <View style={s.container}>
      <View style={[s.dashHeader, { paddingTop: 12 + insets.top, minHeight: 72 + insets.top }]}>
        <View style={s.dashHeaderContent}>
          <View>
            <Text style={s.greeting}>{user ? getGreeting(user.name) : "Olá 👋"}</Text>
            <Text style={s.dateText}>{formatDate()}</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(app)/(tabs)/notifications")}
            style={s.bellBtn}
          >
            <Ionicons name="notifications-outline" size={22} color={c.textSub} />
            {unreadCount > 0 && <View style={s.bellDot} />}
          </TouchableOpacity>
        </View>
        {user?.role === "super_admin" && (
          <TouchableOpacity
            style={s.activeCompanyBanner}
            onPress={() => router.push("/(app)/select-company" as any)}
          >
            <Ionicons name="business-outline" size={14} color={c.primary} />
            <Text style={s.activeCompanyText}>
              {activeCompanyId
                ? `Operando como Super Admin`
                : "Nenhuma empresa selecionada — toque para escolher"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={c.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Stats 2×2 grid */}
        <View style={s.statsGrid}>
          {STAT_CARDS.map((card, i) => (
            <TouchableOpacity key={i} style={s.statCard} onPress={card.onPress} activeOpacity={0.7}>
              <View style={[s.statIconBox, { backgroundColor: card.iconBg }]}>
                {card.icon}
              </View>
              <Text style={s.statValue}>{card.value}</Text>
              <Text style={s.statLabel}>{card.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Calibration alert */}
        {calibrationCount > 0 && (
          <View style={s.alertBanner}>
            <Ionicons name="warning-outline" size={18} color="#ca8a04" />
            <View style={s.alertContent}>
              <Text style={s.alertTitle}>Calibração Pendente</Text>
              <Text style={s.alertDesc} numberOfLines={1}>
                {calibrationList.slice(0, 2).map((e) => e.name).join(", ")}
                {calibrationCount > 2 ? ` e mais ${calibrationCount - 2}` : ""}
              </Text>
            </View>
            <TouchableOpacity onPress={() => router.push("/(app)/(tabs)/equipment")}>
              <Text style={s.alertLink}>Ver</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Quick Actions */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Ações Rápidas</Text>
        </View>
        <View style={s.actionsRow}>
          <TouchableOpacity style={s.actionBtn} onPress={() => router.push("/(app)/(tabs)/scan" as any)}>
            <View style={[s.actionIcon, { backgroundColor: c.primaryLight }]}>
              <Ionicons name="qr-code-outline" size={22} color={c.primary} />
            </View>
            <Text style={s.actionLabel}>Escanear QR</Text>
          </TouchableOpacity>

          {can(user, "ticket:create") && (
            <TouchableOpacity style={s.actionBtn} onPress={() => router.push("/(app)/tickets/new")}>
              <View style={[s.actionIcon, { backgroundColor: "#f0fdf4" }]}>
                <Ionicons name="add-circle-outline" size={22} color="#16a34a" />
              </View>
              <Text style={s.actionLabel}>Novo Chamado</Text>
            </TouchableOpacity>
          )}

          {can(user, "equipment:create") && (
            <TouchableOpacity style={s.actionBtn} onPress={() => router.push("/(app)/equipment/new")}>
              <View style={[s.actionIcon, { backgroundColor: "#eff6ff" }]}>
                <Ionicons name="cube-outline" size={22} color="#2563eb" />
              </View>
              <Text style={s.actionLabel}>Equipamento</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={s.actionBtn} onPress={() => router.push("/(app)/profile")}>
            <View style={[s.actionIcon, { backgroundColor: c.surface2 }]}>
              <Ionicons name="person-outline" size={22} color={c.textSub} />
            </View>
            <Text style={s.actionLabel}>Ver Perfil</Text>
          </TouchableOpacity>
        </View>

        {/* Recent equipment horizontal scroll */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Equipamentos Recentes</Text>
          <TouchableOpacity onPress={() => router.push("/(app)/(tabs)/equipment")}>
            <Text style={s.seeAll}>Ver todos →</Text>
          </TouchableOpacity>
        </View>

        {loadingRecentEquip ? (
          <ActivityIndicator size="small" color={c.primary} style={{ marginVertical: 12 }} />
        ) : recentEquipment.length === 0 ? (
          <Text style={s.emptyText}>Nenhum equipamento cadastrado.</Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.equipScrollContent}
          >
            {recentEquipment.map((eq) => (
              <TouchableOpacity
                key={eq.id}
                style={s.equipCard}
                onPress={() => router.push(`/(app)/equipment/${eq.id}`)}
                activeOpacity={0.7}
              >
                <View style={s.equipCardIcon}>
                  <Ionicons name="cube-outline" size={18} color={c.primary} />
                </View>
                <Text style={s.equipCardName} numberOfLines={2}>{eq.name}</Text>
                <Text style={s.equipCardCode}>{eq.internal_code}</Text>
                <Badge type={eq.status} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Recent tickets */}
        <View style={[s.sectionHeader, { marginTop: 8 }]}>
          <Text style={s.sectionTitle}>Chamados Ativos</Text>
          <TouchableOpacity onPress={() => router.push("/(app)/(tabs)/tickets")}>
            <Text style={s.seeAll}>Ver todos →</Text>
          </TouchableOpacity>
        </View>

        {loadingTickets ? (
          <ActivityIndicator size="small" color={c.primary} style={{ marginVertical: 12 }} />
        ) : recentTickets.filter((t) => t.status !== "resolved" && t.status !== "closed").length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>Nenhum chamado ativo no momento.</Text>
          </View>
        ) : (
          recentTickets
            .filter((t) => t.status !== "resolved" && t.status !== "closed")
            .map((ticket) => (
              <TouchableOpacity
                key={ticket.id}
                style={s.ticketCard}
                onPress={() => router.push(`/(app)/tickets/${ticket.id}`)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    s.ticketPriorityBar,
                    { backgroundColor: PRIORITY_COLORS[ticket.priority] ?? "#9ca3af" },
                  ]}
                />
                <View style={s.ticketContent}>
                  <View style={s.ticketTop}>
                    <Text style={s.ticketTitle} numberOfLines={1}>{ticket.title}</Text>
                    <Badge type={ticket.status} />
                  </View>
                  <Text style={s.ticketEquip}>
                    {ticket.equipment ? ticket.equipment.name : "Sem equipamento"}
                  </Text>
                  <View style={s.ticketBottom}>
                    <Badge type={ticket.priority} />
                  </View>
                </View>
              </TouchableOpacity>
            ))
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(c: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    dashHeader: {
      backgroundColor: c.dashHeader,
      borderBottomWidth: 1,
      borderBottomColor: c.dashHeaderBorder,
      paddingHorizontal: 20,
      paddingBottom: 14,
    },
    dashHeaderContent: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    greeting: { fontSize: 20, fontWeight: "700", color: c.text },
    dateText: { fontSize: 13, color: c.textMuted, marginTop: 2, textTransform: "capitalize" },
    bellBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: c.surface2,
      justifyContent: "center",
      alignItems: "center",
    },
    bellDot: {
      position: "absolute",
      top: 8,
      right: 8,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#ef4444",
      borderWidth: 2,
      borderColor: c.dashHeader,
    },
    activeCompanyBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 8,
      backgroundColor: c.primaryLight,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
    },
    activeCompanyText: { color: c.primary, fontSize: 12, fontWeight: "600" },
    scrollContainer: { padding: 16, paddingBottom: 36 },
    statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
    statCard: {
      width: "48%",
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
      gap: 8,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 1,
    },
    statIconBox: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
    statValue: { fontSize: 24, fontWeight: "700", color: c.text, lineHeight: 28 },
    statLabel: { fontSize: 11, color: c.textMuted, fontWeight: "500" },
    alertBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: "#fef9c3",
      borderWidth: 1,
      borderColor: "#fde047",
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
    },
    alertContent: { flex: 1 },
    alertTitle: { fontSize: 13, fontWeight: "600", color: "#854d0e" },
    alertDesc: { fontSize: 12, color: "#a16207", marginTop: 2 },
    alertLink: { fontSize: 12, fontWeight: "700", color: "#854d0e", textDecorationLine: "underline" },
    sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
    sectionTitle: { fontSize: 15, fontWeight: "700", color: c.text },
    seeAll: { fontSize: 13, color: c.primary, fontWeight: "500" },
    actionsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
    actionBtn: { alignItems: "center", width: "22%" },
    actionIcon: {
      width: 50,
      height: 50,
      borderRadius: 14,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 6,
      borderWidth: 1,
      borderColor: c.border,
    },
    actionLabel: { color: c.textMuted, fontSize: 11, fontWeight: "500", textAlign: "center" },
    equipScrollContent: { gap: 10, paddingBottom: 4, marginBottom: 8 },
    equipCard: {
      width: 140,
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      padding: 12,
      gap: 6,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
      elevation: 1,
    },
    equipCardIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: c.primaryLight,
      justifyContent: "center",
      alignItems: "center",
    },
    equipCardName: { fontSize: 12, fontWeight: "600", color: c.text, lineHeight: 16 },
    equipCardCode: {
      fontSize: 10,
      color: c.textMuted,
      fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    },
    ticketCard: {
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 10,
      overflow: "hidden",
      flexDirection: "row",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
      elevation: 1,
    },
    ticketPriorityBar: { width: 4, alignSelf: "stretch" },
    ticketContent: { flex: 1, padding: 12 },
    ticketTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
    ticketTitle: { fontSize: 13, fontWeight: "600", color: c.text, flex: 1, marginRight: 8 },
    ticketEquip: { fontSize: 11, color: c.textMuted, marginBottom: 8 },
    ticketBottom: { flexDirection: "row", gap: 6 },
    emptyCard: {
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      padding: 24,
      alignItems: "center",
    },
    emptyText: { color: c.textMuted, fontSize: 14 },
  });
}
