import React, { useState, useMemo, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../auth/AuthProvider";
import { CustomHeader } from "../../../components/ui/CustomHeader";
import { apiFetch } from "../../../api/client";
import { useTheme } from "../../../contexts/ThemeContext";

type Tab = "gastos" | "manutencao" | "calibracao" | "chamados";

interface ReportData {
  spending: {
    totals: { equipment: number; calibration: number; maintenance: number };
    by_equipment: { id: string; name: string; acquisition_cost: number; calibration_cost: number; maintenance_cost: number }[];
  };
  maintenance: {
    by_equipment: { id: string; name: string; total: number; last_maintenance: string | null; avg_interval_days: number | null }[];
  };
  calibration: {
    totals: { total_scheduled: number; overdue: number; upcoming: number; ok: number };
    by_equipment: { id: string; name: string; periodicity_days: number | null; next_calibration: string | null; status: string }[];
  };
  tickets: {
    totals: { total: number; avg_resolution_days: number | null; avg_open_days: number | null };
    by_type: Record<string, number>;
    by_priority: Record<string, number>;
  };
}

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

const CAL_STATUS: Record<string, { label: string; color: string }> = {
  overdue:     { label: "Atrasada",   color: "#dc2626" },
  upcoming:    { label: "Próxima",    color: "#d97706" },
  ok:          { label: "Em dia",     color: "#059669" },
  no_schedule: { label: "Sem agenda", color: "#9ca3af" },
};

const PRIO_COLORS: Record<string, { label: string; color: string }> = {
  low:      { label: "Baixa",   color: "#059669" },
  medium:   { label: "Média",   color: "#d97706" },
  high:     { label: "Alta",    color: "#dc2626" },
  critical: { label: "Crítica", color: "#7c3aed" },
};

const TYPE_LABELS: Record<string, string> = {
  maintenance: "Manutenção", calibration: "Calibração", repair: "Reparo",
  inspection: "Inspeção", installation: "Instalação", other: "Outro",
};

export default function ReportsScreen() {
  const { user, activeCompanyId } = useAuth();
  const { colors: c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const [tab, setTab] = useState<Tab>("gastos");

  const companyId = user?.role === "super_admin" ? activeCompanyId ?? undefined : undefined;

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["reports", companyId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (companyId) params.set("company_id", companyId);
      return apiFetch<ReportData>(`/api/reports?${params}`);
    },
    staleTime: 60_000,
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: "gastos",     label: "Gastos" },
    { key: "manutencao", label: "Manutenção" },
    { key: "calibracao", label: "Calibração" },
    { key: "chamados",   label: "Chamados" },
  ];

  return (
    <View style={s.container}>
      <CustomHeader title="Relatórios" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} />}
      >
        {/* Tab strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabStrip} contentContainerStyle={s.tabStripContent}>
          {tabs.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[s.tabBtn, tab === t.key && s.tabBtnActive]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[s.tabLabel, tab === t.key && s.tabLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {isLoading && (
          <View style={s.center}>
            <ActivityIndicator color={c.primary} size="large" />
            <Text style={s.loadingText}>Carregando...</Text>
          </View>
        )}

        {isError && (
          <View style={s.center}>
            <Text style={s.errorText}>Erro ao carregar relatório</Text>
            <TouchableOpacity onPress={() => refetch()} style={s.retryBtn}>
              <Text style={[s.retryText, { color: c.primary }]}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        )}

        {data && (
          <>
            {/* ── GASTOS ── */}
            {tab === "gastos" && (
              <View style={s.section}>
                <View style={s.cardRow}>
                  <View style={[s.statCard, { flex: 1 }]}>
                    <Text style={[s.statLabel, { color: "#0363a9" }]}>Aquisição</Text>
                    <Text style={s.statValue}>R$ {fmt(data.spending.totals.equipment)}</Text>
                  </View>
                  <View style={[s.statCard, { flex: 1 }]}>
                    <Text style={[s.statLabel, { color: "#059669" }]}>Calibrações</Text>
                    <Text style={s.statValue}>R$ {fmt(data.spending.totals.calibration)}</Text>
                  </View>
                </View>
                <View style={s.cardRow}>
                  <View style={[s.statCard, { flex: 1 }]}>
                    <Text style={[s.statLabel, { color: "#d97706" }]}>Manutenções</Text>
                    <Text style={s.statValue}>R$ {fmt(data.spending.totals.maintenance)}</Text>
                  </View>
                  <View style={[s.statCard, { flex: 1 }]}>
                    <Text style={[s.statLabel, { color: "#6b7280" }]}>Total Geral</Text>
                    <Text style={s.statValue}>R$ {fmt(data.spending.totals.equipment + data.spending.totals.calibration + data.spending.totals.maintenance)}</Text>
                  </View>
                </View>
                <View style={s.tableCard}>
                  <Text style={s.tableTitle}>Por Equipamento</Text>
                  {data.spending.by_equipment.length === 0 ? (
                    <Text style={s.empty}>Nenhum dado</Text>
                  ) : data.spending.by_equipment.map((row) => (
                    <View key={row.id} style={s.tableRow}>
                      <Text style={s.tableEquipName} numberOfLines={1}>{row.name}</Text>
                      <View style={s.tableCosts}>
                        <Text style={s.tableSubCell}>Aquisição: R$ {fmt(row.acquisition_cost)}</Text>
                        <Text style={s.tableSubCell}>Calibrações: R$ {fmt(row.calibration_cost)}</Text>
                        <Text style={s.tableSubCell}>Manutenções: R$ {fmt(row.maintenance_cost)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ── MANUTENÇÃO ── */}
            {tab === "manutencao" && (
              <View style={s.section}>
                <View style={s.tableCard}>
                  <Text style={s.tableTitle}>Frequência de Manutenção</Text>
                  {data.maintenance.by_equipment.length === 0 ? (
                    <Text style={s.empty}>Nenhum dado</Text>
                  ) : data.maintenance.by_equipment.map((row) => (
                    <View key={row.id} style={s.tableRow}>
                      <Text style={s.tableEquipName} numberOfLines={1}>{row.name}</Text>
                      <View style={s.tableCosts}>
                        <Text style={s.tableSubCell}>Total: {row.total} manutenção(ões)</Text>
                        <Text style={s.tableSubCell}>Última: {fmtDate(row.last_maintenance)}</Text>
                        <Text style={s.tableSubCell}>Intervalo médio: {row.avg_interval_days != null ? `${row.avg_interval_days} dias` : "—"}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ── CALIBRAÇÃO ── */}
            {tab === "calibracao" && (
              <View style={s.section}>
                <View style={s.cardRow}>
                  <View style={[s.statCard, { flex: 1 }]}>
                    <Text style={[s.statLabel, { color: "#dc2626" }]}>Atrasadas</Text>
                    <Text style={[s.statValue, { color: "#dc2626" }]}>{data.calibration.totals.overdue}</Text>
                  </View>
                  <View style={[s.statCard, { flex: 1 }]}>
                    <Text style={[s.statLabel, { color: "#d97706" }]}>Próximas</Text>
                    <Text style={[s.statValue, { color: "#d97706" }]}>{data.calibration.totals.upcoming}</Text>
                  </View>
                </View>
                <View style={s.cardRow}>
                  <View style={[s.statCard, { flex: 1 }]}>
                    <Text style={[s.statLabel, { color: "#059669" }]}>Em dia</Text>
                    <Text style={[s.statValue, { color: "#059669" }]}>{data.calibration.totals.ok}</Text>
                  </View>
                  <View style={[s.statCard, { flex: 1 }]}>
                    <Text style={[s.statLabel, { color: "#6b7280" }]}>Com agenda</Text>
                    <Text style={s.statValue}>{data.calibration.totals.total_scheduled}</Text>
                  </View>
                </View>
                <View style={s.tableCard}>
                  <Text style={s.tableTitle}>Por Equipamento</Text>
                  {data.calibration.by_equipment.length === 0 ? (
                    <Text style={s.empty}>Nenhum dado</Text>
                  ) : data.calibration.by_equipment.map((row) => {
                    const st = CAL_STATUS[row.status] ?? CAL_STATUS.no_schedule;
                    return (
                      <View key={row.id} style={s.tableRow}>
                        <View style={s.tableRowLeft}>
                          <Text style={s.tableEquipName} numberOfLines={1}>{row.name}</Text>
                          <Text style={s.tableSubCell}>Próxima: {fmtDate(row.next_calibration)}</Text>
                        </View>
                        <View style={[s.statusBadge, { borderColor: st.color }]}>
                          <Text style={[s.statusLabel, { color: st.color }]}>{st.label}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ── CHAMADOS ── */}
            {tab === "chamados" && (
              <View style={s.section}>
                <View style={s.cardRow}>
                  <View style={[s.statCard, { flex: 1 }]}>
                    <Text style={[s.statLabel, { color: "#0363a9" }]}>Total</Text>
                    <Text style={s.statValue}>{data.tickets.totals.total}</Text>
                  </View>
                  <View style={[s.statCard, { flex: 1 }]}>
                    <Text style={[s.statLabel, { color: "#d97706" }]}>Tempo médio aberto</Text>
                    <Text style={s.statValue}>{data.tickets.totals.avg_open_days != null ? `${data.tickets.totals.avg_open_days}d` : "—"}</Text>
                  </View>
                </View>
                <View style={[s.statCard, { marginBottom: 12 }]}>
                  <Text style={[s.statLabel, { color: "#059669" }]}>Tempo médio resolução</Text>
                  <Text style={s.statValue}>{data.tickets.totals.avg_resolution_days != null ? `${data.tickets.totals.avg_resolution_days} dias` : "—"}</Text>
                </View>
                <View style={s.tableCard}>
                  <Text style={s.tableTitle}>Por Tipo</Text>
                  {Object.keys(data.tickets.by_type).length === 0 ? (
                    <Text style={s.empty}>Sem dados</Text>
                  ) : Object.entries(data.tickets.by_type).map(([type, count]) => (
                    <View key={type} style={s.kv}>
                      <Text style={s.kvKey}>{TYPE_LABELS[type] ?? type}</Text>
                      <Text style={s.kvVal}>{count}</Text>
                    </View>
                  ))}
                </View>
                <View style={s.tableCard}>
                  <Text style={s.tableTitle}>Por Prioridade</Text>
                  {Object.keys(data.tickets.by_priority).length === 0 ? (
                    <Text style={s.empty}>Sem dados</Text>
                  ) : Object.entries(data.tickets.by_priority).map(([prio, count]) => {
                    const p = PRIO_COLORS[prio];
                    return (
                      <View key={prio} style={s.kv}>
                        <Text style={[s.kvKey, p ? { color: p.color } : undefined]}>{p?.label ?? prio}</Text>
                        <Text style={s.kvVal}>{count}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(c: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { paddingBottom: 32 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 64 },
    loadingText: { marginTop: 12, color: c.textSecondary, fontSize: 14 },
    errorText: { color: "#dc2626", fontSize: 14 },
    retryBtn: { marginTop: 12 },
    retryText: { fontSize: 14, fontWeight: "600" },
    tabStrip: { borderBottomWidth: 1, borderBottomColor: c.border },
    tabStripContent: { paddingHorizontal: 16, paddingVertical: 0 },
    tabBtn: {
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 2, borderBottomColor: "transparent",
    },
    tabBtnActive: { borderBottomColor: c.primary },
    tabLabel: { fontSize: 13, fontWeight: "500", color: c.textSecondary },
    tabLabelActive: { color: c.primary, fontWeight: "600" },
    section: { padding: 16, gap: 12 },
    cardRow: { flexDirection: "row", gap: 12, marginBottom: 0 },
    statCard: {
      backgroundColor: c.card, borderRadius: 12, padding: 16,
      borderWidth: 1, borderColor: c.border, marginBottom: 12,
    },
    statLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
    statValue: { fontSize: 20, fontWeight: "800", color: c.text },
    tableCard: {
      backgroundColor: c.card, borderRadius: 12, padding: 16,
      borderWidth: 1, borderColor: c.border,
    },
    tableTitle: { fontSize: 14, fontWeight: "700", color: c.text, marginBottom: 12 },
    tableRow: {
      paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border,
      flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    },
    tableRowLeft: { flex: 1, marginRight: 8 },
    tableEquipName: { fontSize: 13, fontWeight: "600", color: c.text, marginBottom: 4 },
    tableCosts: { gap: 2 },
    tableSubCell: { fontSize: 12, color: c.textSecondary },
    statusBadge: {
      borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
      alignSelf: "flex-start",
    },
    statusLabel: { fontSize: 11, fontWeight: "600" },
    kv: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border,
    },
    kvKey: { fontSize: 13, color: c.text },
    kvVal: { fontSize: 13, fontWeight: "700", color: c.text },
    empty: { fontSize: 13, color: c.textSecondary, textAlign: "center", paddingVertical: 12 },
  });
}
