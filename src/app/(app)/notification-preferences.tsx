import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "../../api/notifications";
import { Card } from "../../components/ui/Card";

type Prefs = { cal_alert: boolean; unassigned: boolean; weekly: boolean };

const PREF_ROWS: { key: keyof Prefs; label: string; description: string; icon: string }[] = [
  { key: "cal_alert", label: "Alertas de Calibração", description: "Notificar quando uma calibração estiver próxima do vencimento", icon: "flask-outline" },
  { key: "unassigned", label: "Chamados Não Atribuídos", description: "Notificar quando um novo chamado não tiver responsável", icon: "ticket-outline" },
  { key: "weekly", label: "Resumo Semanal", description: "Receber um resumo semanal das atividades da empresa", icon: "calendar-outline" },
];

export default function NotificationPreferencesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => notificationsApi.getPreferences(),
  });

  const mutation = useMutation({
    mutationFn: (prefs: Partial<Prefs>) => notificationsApi.updatePreferences(prefs),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notification-preferences"] }),
    onError: (err: any) => Alert.alert("Erro", err.message || "Não foi possível salvar as preferências."),
  });

  const prefs = data?.data ?? { cal_alert: true, unassigned: true, weekly: false };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backAction}>
          <Ionicons name="arrow-back" size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Preferências de Notificação</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {isLoading ? (
          <View style={s.center}><ActivityIndicator size="large" color="#6366F1" /></View>
        ) : isError ? (
          <View style={s.center}>
            <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
            <Text style={s.errorText}>Erro ao carregar preferências.</Text>
          </View>
        ) : (
          <Card style={s.card}>
            <Text style={s.sectionTitle}>Configurar Notificações</Text>
            {PREF_ROWS.map((row, i) => (
              <View key={row.key} style={[s.row, i === PREF_ROWS.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={[s.iconBox, { backgroundColor: "#1A1A2E" }]}>
                  <Ionicons name={row.icon as any} size={20} color="#818CF8" />
                </View>
                <View style={s.rowText}>
                  <Text style={s.rowLabel}>{row.label}</Text>
                  <Text style={s.rowDesc}>{row.description}</Text>
                </View>
                <Switch
                  value={prefs[row.key]}
                  onValueChange={(v) => mutation.mutate({ [row.key]: v })}
                  disabled={mutation.isPending}
                  trackColor={{ false: "#2E3033", true: "#6366F1" }}
                  thumbColor="#FFFFFF"
                />
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F0F10" },
  header: { height: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#111214", borderBottomWidth: 1, borderBottomColor: "#2E3033", paddingHorizontal: 16, paddingTop: 12 },
  backAction: { padding: 4 },
  headerTitle: { color: "#F8FAFC", fontSize: 16, fontWeight: "700" },
  scroll: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 48 },
  errorText: { color: "#EF4444", fontSize: 14, marginTop: 12 },
  card: { backgroundColor: "#151618" },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 16 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#212225", gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  rowText: { flex: 1 },
  rowLabel: { color: "#E2E8F0", fontSize: 14, fontWeight: "600", marginBottom: 2 },
  rowDesc: { color: "#64748B", fontSize: 12, lineHeight: 16 },
});
