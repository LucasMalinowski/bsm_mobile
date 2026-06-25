import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, Alert, RefreshControl } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../../auth/AuthProvider";
import { can } from "../../../auth/permissions";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { equipmentApi } from "../../../api/equipment";
import { calibrationApi } from "../../../api/calibration";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function EquipmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"info" | "calibration" | "history">("info");

  // Fetch Equipment
  const { data: eqData, isLoading, isError, refetch } = useQuery({
    queryKey: ["equipment", id],
    queryFn: () => equipmentApi.get(id),
  });

  // Fetch Calibrations
  const { data: pointsData } = useQuery({
    queryKey: ["calibration-points", id],
    queryFn: () => calibrationApi.getPoints(id),
    enabled: !!id,
  });

  const { data: recordsData } = useQuery({
    queryKey: ["calibration-records", id],
    queryFn: () => calibrationApi.getRecords(id),
    enabled: !!id,
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: () => equipmentApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      Alert.alert("Sucesso", "Equipamento excluído com sucesso!");
      router.replace("/(app)/(tabs)/equipment");
    },
    onError: (err: any) => {
      Alert.alert("Erro", err.message || "Não foi possível excluir o equipamento.");
    },
  });

  const handleDelete = () => {
    Alert.alert(
      "Confirmar Exclusão",
      "Deseja realmente excluir este equipamento? Esta ação não pode ser desfeita.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Excluir", style: "destructive", onPress: () => deleteMutation.mutate() },
      ]
    );
  };

  const formatDateStr = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    try {
      return format(new Date(dateStr), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  if (isError || !eqData?.data) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text style={styles.errorText}>Erro ao carregar detalhes do equipamento.</Text>
        <TouchableOpacity onPress={() => refetch()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Tentar Novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const eq = eqData.data;
  const history = eq.history ?? [];
  const points = pointsData?.data ?? [];
  const records = recordsData?.data ?? [];

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backAction}>
          <Ionicons name="arrow-back" size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Detalhes do Equipamento
        </Text>
        <View style={{ width: 24 }} /> {/* Balance space */}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#6366F1" />}
      >
        {/* Equipment Basic Info Banner */}
        <Card style={styles.bannerCard}>
          {eq.image_url ? (
            <Image source={{ uri: eq.image_url }} style={styles.equipmentImage} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="cube" size={48} color="#475569" />
            </View>
          )}
          <View style={styles.bannerMeta}>
            <Badge type={eq.status} style={styles.statusBadge} />
            <Text style={styles.eqCode}>{eq.internal_code}</Text>
            <Text style={styles.eqName}>{eq.name}</Text>
          </View>
        </Card>

        {/* Custom Tabs */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            onPress={() => setActiveTab("info")}
            style={[styles.tab, activeTab === "info" ? styles.tabActive : null]}
          >
            <Text style={[styles.tabLabel, activeTab === "info" ? styles.tabLabelActive : null]}>
              Especificações
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab("calibration")}
            style={[styles.tab, activeTab === "calibration" ? styles.tabActive : null]}
          >
            <Text style={[styles.tabLabel, activeTab === "calibration" ? styles.tabLabelActive : null]}>
              Calibração
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab("history")}
            style={[styles.tab, activeTab === "history" ? styles.tabActive : null]}
          >
            <Text style={[styles.tabLabel, activeTab === "history" ? styles.tabLabelActive : null]}>
              Histórico
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Contents */}
        {activeTab === "info" && (
          <View>
            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Características Gerais</Text>
              
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Marca</Text>
                <Text style={styles.infoValue}>{eq.brand || "Não especificado"}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Modelo</Text>
                <Text style={styles.infoValue}>{eq.model || "Não especificado"}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Nº de Série</Text>
                <Text style={styles.infoValue}>{eq.serial_number || "Não especificado"}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Localização</Text>
                <Text style={styles.infoValue}>{eq.location || "Não especificado"}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Categoria</Text>
                <Text style={styles.infoValue}>{eq.category?.name || "Não especificado"}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Data de Aquisição</Text>
                <Text style={styles.infoValue}>{formatDateStr(eq.acquisition_date)}</Text>
              </View>
            </Card>

            {eq.notes ? (
              <Card style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Notas Observações</Text>
                <Text style={styles.notesText}>{eq.notes}</Text>
              </Card>
            ) : null}

            {/* Management Buttons */}
            <View style={styles.actionsBox}>
              {can(user, "equipment:update") && (
                <Button
                  title="Editar Equipamento"
                  variant="outline"
                  onPress={() => router.push(`/(app)/equipment/${id}_edit`)}
                  style={styles.actionBtn}
                />
              )}
              {can(user, "equipment:delete") && (
                <Button
                  title="Excluir Equipamento"
                  variant="danger"
                  onPress={handleDelete}
                  style={styles.actionBtn}
                />
              )}
            </View>
          </View>
        )}

        {activeTab === "calibration" && (
          <View>
            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Status de Calibração</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Requer Calibração?</Text>
                <Text style={styles.infoValue}>{eq.requires_calibration ? "Sim" : "Não"}</Text>
              </View>
              {eq.requires_calibration && (
                <>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Periodicidade</Text>
                    <Text style={[styles.infoValue, { textTransform: "capitalize" }]}>
                      {eq.calibration_periodicity || "N/A"}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Última Calibração</Text>
                    <Text style={styles.infoValue}>{formatDateStr(eq.last_calibration)}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Próxima Calibração</Text>
                    <Text style={[styles.infoValue, { color: "#F59E0B", fontWeight: "700" }]}>
                      {formatDateStr(eq.next_calibration)}
                    </Text>
                  </View>
                </>
              )}
            </Card>

            {/* Calibration Points */}
            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Pontos Configurados ({points.length})</Text>
              {points.length === 0 ? (
                <Text style={styles.emptyCardText}>Nenhum ponto de calibração configurado.</Text>
              ) : (
                points.map((p, idx) => (
                  <View key={p.id} style={styles.pointRow}>
                    <Text style={styles.pointNum}>#{idx + 1}</Text>
                    <View style={styles.pointDetails}>
                      <Text style={styles.pointValueText}>Valor: {p.point_value}</Text>
                      <Text style={styles.pointCriterionText}>Critério: {p.criterion}</Text>
                    </View>
                    {p.error_tolerance !== null && (
                      <Text style={styles.pointTolerance}>Tolerância: ±{p.error_tolerance}</Text>
                    )}
                  </View>
                ))
              )}
            </Card>

            {/* Calibration Logs */}
            <Card style={styles.sectionCard}>
              <View style={styles.recordsHeader}>
                <Text style={styles.sectionTitle}>Histórico de Registros ({records.length})</Text>
                {can(user, "calibration:register") && (
                  <TouchableOpacity
                    onPress={() => router.push({ pathname: `/(app)/tickets/new`, params: { equipment_id: id } })}
                    style={styles.registerBtn}
                  >
                    <Text style={styles.registerBtnText}>Solicitar</Text>
                  </TouchableOpacity>
                )}
              </View>

              {records.length === 0 ? (
                <Text style={styles.emptyCardText}>Nenhum histórico registrado ainda.</Text>
              ) : (
                records.map((r) => (
                  <View key={r.id} style={styles.recordRow}>
                    <View style={styles.recordMeta}>
                      <Text style={styles.recordPerformer}>Realizado por: {r.performer?.name || "Desconhecido"}</Text>
                      <Text style={styles.recordDate}>{formatDateStr(r.performed_at)}</Text>
                    </View>
                    {r.notes ? <Text style={styles.recordNotes}>{r.notes}</Text> : null}
                  </View>
                ))
              )}
            </Card>
          </View>
        )}

        {activeTab === "history" && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Linha do Tempo de Atividades</Text>
            {history.length === 0 ? (
              <Text style={styles.emptyCardText}>Nenhum histórico registrado.</Text>
            ) : (
              history.map((h, idx) => (
                <View key={h.id} style={styles.timelineRow}>
                  <View style={styles.timelineIndicators}>
                    <View style={styles.timelineDot} />
                    {idx < history.length - 1 && <View style={styles.timelineLine} />}
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineAction}>{h.action}</Text>
                    <Text style={styles.timelineDesc}>{h.description}</Text>
                    <Text style={styles.timelineUserDate}>
                      {h.user?.name || "Sistema"} • {formatDateStr(h.created_at)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </Card>
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
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0F0F10",
    padding: 24,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 15,
    marginTop: 12,
    textAlign: "center",
    marginBottom: 16,
  },
  backBtn: {
    backgroundColor: "#6366F1",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backBtnText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  header: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#111214",
    borderBottomWidth: 1,
    borderBottomColor: "#2E3033",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  backAction: {
    padding: 4,
  },
  headerTitle: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "700",
    maxWidth: "80%",
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  bannerCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    marginBottom: 16,
  },
  equipmentImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: "#1F2022",
  },
  imagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: "#1C1D20",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2E3033",
  },
  bannerMeta: {
    flex: 1,
    marginLeft: 16,
    justifyContent: "center",
  },
  statusBadge: {
    marginBottom: 6,
  },
  eqCode: {
    fontSize: 18,
    fontWeight: "800",
    color: "#F8FAFC",
  },
  eqName: {
    fontSize: 14,
    color: "#94A3B8",
    marginTop: 2,
  },
  tabsRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#2E3033",
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: "#6366F1",
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#64748B",
  },
  tabLabelActive: {
    color: "#6366F1",
    fontWeight: "700",
  },
  sectionCard: {
    backgroundColor: "#151618",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#F8FAFC",
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#212225",
  },
  infoLabel: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "500",
  },
  infoValue: {
    color: "#E2E8F0",
    fontSize: 13,
    fontWeight: "600",
  },
  notesText: {
    color: "#94A3B8",
    fontSize: 13,
    lineHeight: 18,
  },
  actionsBox: {
    gap: 8,
    marginTop: 8,
    marginBottom: 24,
  },
  actionBtn: {
    marginVertical: 0,
  },
  emptyCardText: {
    color: "#475569",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 12,
  },
  pointRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#212225",
  },
  pointNum: {
    color: "#6366F1",
    fontWeight: "700",
    fontSize: 14,
    marginRight: 12,
  },
  pointDetails: {
    flex: 1,
  },
  pointValueText: {
    color: "#E2E8F0",
    fontSize: 13,
    fontWeight: "600",
  },
  pointCriterionText: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 2,
  },
  pointTolerance: {
    color: "#94A3B8",
    fontSize: 12,
  },
  recordsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  registerBtn: {
    backgroundColor: "#6366F1",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  registerBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  recordRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#212225",
  },
  recordMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  recordPerformer: {
    color: "#E2E8F0",
    fontSize: 13,
    fontWeight: "600",
  },
  recordDate: {
    color: "#64748B",
    fontSize: 11,
  },
  recordNotes: {
    color: "#94A3B8",
    fontSize: 12,
  },
  timelineRow: {
    flexDirection: "row",
    minHeight: 64,
  },
  timelineIndicators: {
    alignItems: "center",
    width: 24,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#6366F1",
    marginTop: 6,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: "#2E3033",
  },
  timelineContent: {
    flex: 1,
    marginLeft: 12,
    paddingBottom: 16,
  },
  timelineAction: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "700",
  },
  timelineDesc: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 2,
  },
  timelineUserDate: {
    color: "#475569",
    fontSize: 11,
    marginTop: 4,
  },
});
