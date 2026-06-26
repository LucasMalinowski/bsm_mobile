import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { CustomHeader } from "../../../components/ui/CustomHeader";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { notificationsApi } from "../../../api/notifications";
import { Notification, NotificationType } from "../../../types/api";
import { useTheme } from "../../../contexts/ThemeContext";

function resolveDeepLink(type: NotificationType, metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null;
  if (
    type === "ticket_created" ||
    type === "ticket_status_changed" ||
    type === "ticket_assigned" ||
    type === "ticket_support_request"
  ) {
    const id = metadata.ticket_id;
    if (id) return `/(app)/tickets/${id}`;
  }
  if (type === "equipment_created" || type === "calibration_due") {
    const id = metadata.equipment_id;
    if (id) return `/(app)/equipment/${id}`;
  }
  return null;
}

const TYPE_ICONS: Record<string, { icon: string; color: string }> = {
  ticket_created: { icon: "add-circle-outline", color: "#34D399" },
  ticket_status_changed: { icon: "refresh-circle-outline", color: "#60A5FA" },
  ticket_assigned: { icon: "person-add-outline", color: "#FBBF24" },
  ticket_support_request: { icon: "help-circle-outline", color: "#F87171" },
  equipment_created: { icon: "cube-outline", color: "#818CF8" },
  calibration_due: { icon: "flask-outline", color: "#FB923C" },
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors: c } = useTheme();
  const queryClient = useQueryClient();
  const s = useMemo(() => makeStyles(c), [c]);
  const [showAll, setShowAll] = useState(false);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["notifications", showAll ? "all" : "unread"],
    queryFn: () => notificationsApi.list(!showAll),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      queryClient.setQueryData<{ data: Notification[] }>(
        ["notifications", showAll ? "all" : "unread"],
        (old) => old ? { data: old.data.filter((n) => n.id !== id) } : old
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const notifications = data?.data ?? [];

  return (
    <View style={s.container}>
      <CustomHeader />

      <View style={s.filterBar}>
        <View style={s.filterToggle}>
          <TouchableOpacity
            onPress={() => setShowAll(false)}
            style={[s.toggleBtn, !showAll && s.toggleBtnActive]}
          >
            <Text style={[s.toggleText, !showAll && s.toggleTextActive]}>Não Lidas</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowAll(true)}
            style={[s.toggleBtn, showAll && s.toggleBtnActive]}
          >
            <Text style={[s.toggleText, showAll && s.toggleTextActive]}>Todas</Text>
          </TouchableOpacity>
        </View>

        {!showAll && notifications.length > 0 && (
          <TouchableOpacity
            onPress={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
            style={s.markAllBtn}
          >
            <Text style={s.markAllText}>Marcar Todas</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={s.center}><ActivityIndicator size="large" color={c.primary} /></View>
      ) : isError ? (
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={48} color="#EF4444" />
          <Text style={s.errorText}>Erro ao carregar notificações.</Text>
          <Button title="Tentar Novamente" onPress={() => refetch()} variant="outline" style={{ marginTop: 16, width: 200 }} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="notifications-off-outline" size={56} color={c.textMuted} />
          <Text style={s.emptyTitle}>Tudo em dia!</Text>
          <Text style={s.emptySubtitle}>
            {showAll ? "Nenhuma notificação registrada." : "Nenhuma notificação não lida no momento."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          contentContainerStyle={s.list}
          refreshing={isFetching}
          onRefresh={refetch}
          renderItem={({ item }) => {
            const isUnread = !item.read_at;
            const iconCfg = TYPE_ICONS[item.type] ?? { icon: "notifications-outline", color: c.textSub };
            const deepLink = resolveDeepLink(item.type, item.metadata);
            return (
              <TouchableOpacity
                onPress={() => {
                  if (isUnread) markReadMutation.mutate(item.id);
                  if (deepLink) router.push(deepLink as any);
                }}
                activeOpacity={0.8}
              >
                <Card style={[s.notifCard, isUnread ? s.notifCardUnread : undefined]}>
                  <View style={[s.iconBox, { backgroundColor: `${iconCfg.color}20` }]}>
                    <Ionicons name={iconCfg.icon as any} size={22} color={iconCfg.color} />
                  </View>
                  <View style={s.notifBody}>
                    <View style={s.notifTop}>
                      <Text style={[s.notifTitle, isUnread && s.notifTitleUnread]}>{item.title}</Text>
                      {isUnread && <View style={s.unreadDot} />}
                    </View>
                    <Text style={s.notifText} numberOfLines={2}>{item.body}</Text>
                    <Text style={s.notifDate}>{new Date(item.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</Text>
                  </View>
                  {deepLink && (
                    <Ionicons name="chevron-forward" size={16} color={c.textMuted} style={{ alignSelf: "center", marginLeft: 4 }} />
                  )}
                </Card>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

function makeStyles(c: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    filterBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border },
    filterToggle: { flexDirection: "row", backgroundColor: c.surface2, borderRadius: 8, padding: 2 },
    toggleBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 6 },
    toggleBtnActive: { backgroundColor: c.primary },
    toggleText: { fontSize: 13, color: c.textSub, fontWeight: "500" },
    toggleTextActive: { color: "#FFFFFF", fontWeight: "600" },
    markAllBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: c.primaryLight, borderWidth: 1, borderColor: c.primaryBorder },
    markAllText: { color: c.primary, fontSize: 12, fontWeight: "600" },
    center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
    errorText: { color: "#EF4444", fontSize: 14, marginTop: 12, textAlign: "center" },
    emptyTitle: { color: c.text, fontSize: 18, fontWeight: "700", marginTop: 16 },
    emptySubtitle: { color: c.textMuted, fontSize: 13, marginTop: 8, textAlign: "center" },
    list: { padding: 16, paddingBottom: 32 },
    notifCard: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10, padding: 14 },
    notifCardUnread: { borderLeftWidth: 3, borderLeftColor: c.primary, backgroundColor: c.primaryLight },
    iconBox: { width: 44, height: 44, borderRadius: 10, justifyContent: "center", alignItems: "center", marginRight: 14 },
    notifBody: { flex: 1 },
    notifTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
    notifTitle: { fontSize: 14, fontWeight: "600", color: c.textSub, flex: 1, marginRight: 8 },
    notifTitleUnread: { color: c.text },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary },
    notifText: { fontSize: 13, color: c.textSub, lineHeight: 18, marginBottom: 6 },
    notifDate: { fontSize: 11, color: c.textMuted },
  });
}
