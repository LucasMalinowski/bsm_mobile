import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, Alert, RefreshControl, Modal, TextInput } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../../auth/AuthProvider";
import { can } from "../../../auth/permissions";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { equipmentApi } from "../../../api/equipment";
import { calibrationApi } from "../../../api/calibration";
import { maintenanceApi } from "../../../api/maintenances";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTheme } from "../../../contexts/ThemeContext";
import type { Colors } from "../../../constants/colors";

const ACTION_LABELS: Record<string, string> = {
  created: "Criado",
  updated: "Atualizado",
  deleted: "Excluído",
  status_changed: "Status alterado",
  calibration_registered: "Calibração registrada",
  calibration_updated: "Calibração atualizada",
  maintenance_added: "Manutenção registrada",
  maintenance_updated: "Manutenção atualizada",
  document_uploaded: "Documento enviado",
  document_updated: "Documento atualizado",
  document_deleted: "Documento excluído",
};

function translateAction(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export default function EquipmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { colors: c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"info" | "calibration" | "history" | "maintenance">("info");
  const [maintModalVisible, setMaintModalVisible] = useState(false);
  const [maintDate, setMaintDate] = useState("");
  const [maintDesc, setMaintDesc] = useState("");
  const [maintCost, setMaintCost] = useState("");
  const [maintNotes, setMaintNotes] = useState("");

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

  const { data: maintData } = useQuery({
    queryKey: ["maintenances", id],
    queryFn: () => maintenanceApi.list(id),
    enabled: !!id,
  });

  const addMaintMutation = useMutation({
    mutationFn: (data: { performed_at: string; description: string; cost: number | null; notes: string | null }) =>
      maintenanceApi.create(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenances", id] });
      setMaintModalVisible(false);
      setMaintDate("");
      setMaintDesc("");
      setMaintCost("");
      setMaintNotes("");
      Alert.alert("Sucesso", "Manutenção registrada com sucesso!");
    },
    onError: (err: any) => Alert.alert("Erro", err.message || "Não foi possível registrar a manutenção."),
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
      <View style={s.centerContainer}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  if (isError || !eqData?.data) {
    return (
      <View style={s.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={c.error} />
        <Text style={s.errorText}>Erro ao carregar detalhes do equipamento.</Text>
        <TouchableOpacity onPress={() => refetch()} style={s.backBtn}>
          <Text style={s.backBtnText}>Tentar Novamente</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} style={[s.backBtn, { marginTop: 10, backgroundColor: "transparent", borderWidth: 1, borderColor: c.border }]}>
          <Text style={[s.backBtnText, { color: c.textSub }]}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const eq = eqData.data;
  const history = eq.history ?? [];
  const points = pointsData?.data ?? [];
  const records = recordsData?.data ?? [];
  const maintenances = maintData?.data ?? [];

  return (
    <View style={s.container}>
      {/* Header Bar */}
      <View style={[s.header, { paddingTop: 12 + insets.top, minHeight: 64 + insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backAction}>
          <Ionicons name="arrow-back" size={24} color={c.headerText} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>
          Detalhes do Equipamento
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContainer}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={c.primary} />}
      >
        {/* Equipment Basic Info Banner */}
        <Card style={s.bannerCard}>
          {eq.image_url ? (
            <Image source={{ uri: eq.image_url }} style={s.equipmentImage} />
          ) : (
            <View style={s.imagePlaceholder}>
              <Ionicons name="cube" size={48} color={c.textMuted} />
            </View>
          )}
          <View style={s.bannerMeta}>
            <Badge type={eq.status} style={s.statusBadge} />
            <Text style={s.eqCode}>{eq.internal_code}</Text>
            <Text style={s.eqName}>{eq.name}</Text>
          </View>
        </Card>

        {/* Custom Tabs */}
        <View style={s.tabsRow}>
          <TouchableOpacity
            onPress={() => setActiveTab("info")}
            style={[s.tab, activeTab === "info" ? s.tabActive : null]}
          >
            <Text style={[s.tabLabel, activeTab === "info" ? s.tabLabelActive : null]}>
              Especificações
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab("calibration")}
            style={[s.tab, activeTab === "calibration" ? s.tabActive : null]}
          >
            <Text style={[s.tabLabel, activeTab === "calibration" ? s.tabLabelActive : null]}>
              Calibração
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab("history")}
            style={[s.tab, activeTab === "history" ? s.tabActive : null]}
          >
            <Text style={[s.tabLabel, activeTab === "history" ? s.tabLabelActive : null]}>
              Histórico
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab("maintenance")}
            style={[s.tab, activeTab === "maintenance" ? s.tabActive : null]}
          >
            <Text style={[s.tabLabel, activeTab === "maintenance" ? s.tabLabelActive : null]}>
              Manutenção
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Contents */}
        {activeTab === "info" && (
          <View>
            <Card style={s.sectionCard}>
              <Text style={s.sectionTitle}>Características Gerais</Text>

              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Marca</Text>
                <Text style={s.infoValue}>{eq.brand || "Não especificado"}</Text>
              </View>

              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Modelo</Text>
                <Text style={s.infoValue}>{eq.model || "Não especificado"}</Text>
              </View>

              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Nº de Série</Text>
                <Text style={s.infoValue}>{eq.serial_number || "Não especificado"}</Text>
              </View>

              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Localização</Text>
                <Text style={s.infoValue}>{eq.location || "Não especificado"}</Text>
              </View>

              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Categoria</Text>
                <Text style={s.infoValue}>{eq.category?.name || "Não especificado"}</Text>
              </View>

              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Data de Aquisição</Text>
                <Text style={s.infoValue}>{formatDateStr(eq.acquisition_date)}</Text>
              </View>

              {eq.acquisition_cost != null ? (
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Custo de Aquisição</Text>
                  <Text style={s.infoValue}>
                    R$ {eq.acquisition_cost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              ) : null}
            </Card>

            {eq.notes ? (
              <Card style={s.sectionCard}>
                <Text style={s.sectionTitle}>Notas Observações</Text>
                <Text style={s.notesText}>{eq.notes}</Text>
              </Card>
            ) : null}

            {/* Management Buttons */}
            <View style={s.actionsBox}>
              {can(user, "equipment:update") && (
                <Button
                  title="Editar Equipamento"
                  variant="outline"
                  onPress={() => router.push({ pathname: "/(app)/equipment/[id]_edit" as any, params: { id } })}
                  style={s.actionBtn}
                />
              )}
              {can(user, "equipment:delete") && (
                <Button
                  title="Excluir Equipamento"
                  variant="danger"
                  onPress={handleDelete}
                  style={s.actionBtn}
                />
              )}
            </View>
          </View>
        )}

        {activeTab === "calibration" && (
          <View>
            <Card style={s.sectionCard}>
              <Text style={s.sectionTitle}>Status de Calibração</Text>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Requer Calibração?</Text>
                <Text style={s.infoValue}>{eq.requires_calibration ? "Sim" : "Não"}</Text>
              </View>
              {eq.requires_calibration && (
                <>
                  <View style={s.infoRow}>
                    <Text style={s.infoLabel}>Periodicidade</Text>
                    <Text style={[s.infoValue, { textTransform: "capitalize" }]}>
                      {eq.calibration_periodicity || "N/A"}
                    </Text>
                  </View>
                  <View style={s.infoRow}>
                    <Text style={s.infoLabel}>Última Calibração</Text>
                    <Text style={s.infoValue}>{formatDateStr(eq.last_calibration)}</Text>
                  </View>
                  <View style={s.infoRow}>
                    <Text style={s.infoLabel}>Próxima Calibração</Text>
                    <Text style={[s.infoValue, { color: c.warningText, fontWeight: "700" }]}>
                      {formatDateStr(eq.next_calibration)}
                    </Text>
                  </View>
                </>
              )}
            </Card>

            {/* Calibration Points */}
            <Card style={s.sectionCard}>
              <Text style={s.sectionTitle}>Pontos Configurados ({points.length})</Text>
              {points.length === 0 ? (
                <Text style={s.emptyCardText}>Nenhum ponto de calibração configurado.</Text>
              ) : (
                points.map((p, idx) => (
                  <View key={p.id} style={s.pointRow}>
                    <Text style={s.pointNum}>#{idx + 1}</Text>
                    <View style={s.pointDetails}>
                      <Text style={s.pointValueText}>Valor: {p.point_value}</Text>
                      <Text style={s.pointCriterionText}>Critério: {p.criterion}</Text>
                    </View>
                    {p.error_tolerance !== null && (
                      <Text style={s.pointTolerance}>Tolerância: ±{p.error_tolerance}</Text>
                    )}
                  </View>
                ))
              )}
            </Card>

            {/* Calibration Logs */}
            <Card style={s.sectionCard}>
              <View style={s.recordsHeader}>
                <Text style={s.sectionTitle}>Histórico de Registros ({records.length})</Text>
                {can(user, "calibration:register") && (
                  <TouchableOpacity
                    onPress={() => router.push({ pathname: "/(app)/equipment/calibration/[id]" as any, params: { id } })}
                    style={s.registerBtn}
                  >
                    <Text style={s.registerBtnText}>Registrar</Text>
                  </TouchableOpacity>
                )}
              </View>

              {records.length === 0 ? (
                <Text style={s.emptyCardText}>Nenhum histórico registrado ainda.</Text>
              ) : (
                records.map((r) => (
                  <View key={r.id} style={s.recordRow}>
                    <View style={s.recordMeta}>
                      <Text style={s.recordPerformer}>Realizado por: {r.performer?.name || "Desconhecido"}</Text>
                      <Text style={s.recordDate}>{formatDateStr(r.performed_at)}</Text>
                    </View>
                    {r.notes ? <Text style={s.recordNotes}>{r.notes}</Text> : null}
                  </View>
                ))
              )}
            </Card>
          </View>
        )}

        {activeTab === "history" && (
          <Card style={s.sectionCard}>
            <Text style={s.sectionTitle}>Linha do Tempo de Atividades</Text>
            {history.length === 0 ? (
              <Text style={s.emptyCardText}>Nenhum histórico registrado.</Text>
            ) : (
              history.map((h, idx) => (
                <View key={h.id} style={s.timelineRow}>
                  <View style={s.timelineIndicators}>
                    <View style={s.timelineDot} />
                    {idx < history.length - 1 && <View style={s.timelineLine} />}
                  </View>
                  <View style={s.timelineContent}>
                    <Text style={s.timelineAction}>{translateAction(h.action)}</Text>
                    <Text style={s.timelineDesc}>{h.description}</Text>
                    <Text style={s.timelineUserDate}>
                      {h.user?.name || "Sistema"} • {formatDateStr(h.created_at)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </Card>
        )}

        {activeTab === "maintenance" && (
          <View>
            <Card style={s.sectionCard}>
              <View style={s.recordsHeader}>
                <Text style={s.sectionTitle}>Manutenções ({maintenances.length})</Text>
                {can(user, "calibration:register") && (
                  <TouchableOpacity onPress={() => setMaintModalVisible(true)} style={s.registerBtn}>
                    <Text style={s.registerBtnText}>Registrar</Text>
                  </TouchableOpacity>
                )}
              </View>
              {maintenances.length === 0 ? (
                <Text style={s.emptyCardText}>Nenhuma manutenção registrada.</Text>
              ) : (
                maintenances.map((m) => (
                  <View key={m.id} style={s.maintRow}>
                    <View style={s.recordMeta}>
                      <Text style={s.recordPerformer}>{m.description}</Text>
                      <Text style={s.recordDate}>{formatDateStr(m.performed_at)}</Text>
                    </View>
                    {m.performer?.name ? (
                      <Text style={s.maintPerformer}>Por: {m.performer.name}</Text>
                    ) : null}
                    {m.cost != null ? (
                      <Text style={s.maintCost}>
                        Custo: R$ {m.cost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </Text>
                    ) : null}
                    {m.notes ? <Text style={s.recordNotes}>{m.notes}</Text> : null}
                  </View>
                ))
              )}
            </Card>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={maintModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setMaintModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Registrar Manutenção</Text>

            <Text style={s.modalLabel}>Data de Realização *</Text>
            <TextInput
              style={s.modalInput}
              placeholder="AAAA-MM-DD"
              placeholderTextColor={c.textMuted}
              value={maintDate}
              onChangeText={setMaintDate}
            />

            <Text style={s.modalLabel}>Descrição *</Text>
            <TextInput
              style={[s.modalInput, s.modalTextArea]}
              placeholder="Descreva a manutenção realizada"
              placeholderTextColor={c.textMuted}
              value={maintDesc}
              onChangeText={setMaintDesc}
              multiline
              numberOfLines={3}
            />

            <Text style={s.modalLabel}>Custo (R$)</Text>
            <TextInput
              style={s.modalInput}
              placeholder="Ex: 500.00"
              placeholderTextColor={c.textMuted}
              value={maintCost}
              onChangeText={setMaintCost}
              keyboardType="decimal-pad"
            />

            <Text style={s.modalLabel}>Observações</Text>
            <TextInput
              style={[s.modalInput, s.modalTextArea]}
              placeholder="Observações adicionais"
              placeholderTextColor={c.textMuted}
              value={maintNotes}
              onChangeText={setMaintNotes}
              multiline
              numberOfLines={2}
            />

            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancelBtn} onPress={() => setMaintModalVisible(false)}>
                <Text style={s.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalSaveBtn, addMaintMutation.isPending ? s.modalSaveBtnDisabled : null]}
                onPress={() => {
                  if (!maintDate.trim() || !maintDesc.trim()) {
                    Alert.alert("Campos obrigatórios", "Preencha a data e a descrição.");
                    return;
                  }
                  addMaintMutation.mutate({
                    performed_at: maintDate.trim(),
                    description: maintDesc.trim(),
                    cost: maintCost ? Number(maintCost) : null,
                    notes: maintNotes.trim() || null,
                  });
                }}
                disabled={addMaintMutation.isPending}
              >
                <Text style={s.modalSaveText}>
                  {addMaintMutation.isPending ? "Salvando..." : "Salvar"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },
    centerContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: c.bg,
      padding: 24,
    },
    errorText: {
      color: c.error,
      fontSize: 15,
      marginTop: 12,
      textAlign: "center",
      marginBottom: 16,
    },
    backBtn: {
      backgroundColor: c.primary,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
    },
    backBtnText: {
      color: "#FFFFFF",
      fontWeight: "600",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: c.header,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    backAction: {
      padding: 4,
    },
    headerTitle: {
      color: c.headerText,
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
      backgroundColor: c.surface2,
    },
    imagePlaceholder: {
      width: 80,
      height: 80,
      borderRadius: 8,
      backgroundColor: c.surface2,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: c.border,
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
      color: c.text,
    },
    eqName: {
      fontSize: 14,
      color: c.textSub,
      marginTop: 2,
    },
    tabsRow: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: c.border,
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
      borderBottomColor: c.primary,
    },
    tabLabel: {
      fontSize: 13,
      fontWeight: "500",
      color: c.textMuted,
    },
    tabLabelActive: {
      color: c.primary,
      fontWeight: "700",
    },
    sectionCard: {
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: c.text,
      marginBottom: 16,
    },
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: c.divider,
    },
    infoLabel: {
      color: c.textMuted,
      fontSize: 13,
      fontWeight: "500",
    },
    infoValue: {
      color: c.text,
      fontSize: 13,
      fontWeight: "600",
    },
    notesText: {
      color: c.textSub,
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
      color: c.textMuted,
      fontSize: 13,
      textAlign: "center",
      paddingVertical: 12,
    },
    pointRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: c.divider,
    },
    pointNum: {
      color: c.primary,
      fontWeight: "700",
      fontSize: 14,
      marginRight: 12,
    },
    pointDetails: {
      flex: 1,
    },
    pointValueText: {
      color: c.text,
      fontSize: 13,
      fontWeight: "600",
    },
    pointCriterionText: {
      color: c.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
    pointTolerance: {
      color: c.textSub,
      fontSize: 12,
    },
    recordsHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    registerBtn: {
      backgroundColor: c.primary,
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
      borderBottomColor: c.divider,
    },
    recordMeta: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    recordPerformer: {
      color: c.text,
      fontSize: 13,
      fontWeight: "600",
    },
    recordDate: {
      color: c.textMuted,
      fontSize: 11,
    },
    recordNotes: {
      color: c.textSub,
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
      backgroundColor: c.primary,
      marginTop: 6,
    },
    timelineLine: {
      flex: 1,
      width: 2,
      backgroundColor: c.border,
    },
    timelineContent: {
      flex: 1,
      marginLeft: 12,
      paddingBottom: 16,
    },
    timelineAction: {
      color: c.text,
      fontSize: 14,
      fontWeight: "700",
    },
    timelineDesc: {
      color: c.textSub,
      fontSize: 12,
      marginTop: 2,
    },
    timelineUserDate: {
      color: c.textMuted,
      fontSize: 11,
      marginTop: 4,
    },
    maintRow: {
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: c.divider,
    },
    maintPerformer: {
      color: c.textSub,
      fontSize: 12,
      marginTop: 2,
    },
    maintCost: {
      color: c.successText,
      fontSize: 12,
      marginTop: 2,
      fontWeight: "600",
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: "flex-end",
    },
    modalBox: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 24,
      paddingBottom: 40,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: c.text,
      marginBottom: 20,
    },
    modalLabel: {
      fontSize: 12,
      color: c.textSub,
      marginBottom: 6,
      marginTop: 12,
    },
    modalInput: {
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      color: c.text,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
    },
    modalTextArea: {
      height: 80,
      textAlignVertical: "top",
    },
    modalActions: {
      flexDirection: "row",
      gap: 12,
      marginTop: 20,
    },
    modalCancelBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: "center",
    },
    modalCancelText: {
      color: c.textSub,
      fontWeight: "600",
    },
    modalSaveBtn: {
      flex: 1,
      backgroundColor: c.primary,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: "center",
    },
    modalSaveBtnDisabled: {
      opacity: 0.6,
    },
    modalSaveText: {
      color: "#FFFFFF",
      fontWeight: "700",
    },
  });
}
