import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, TextInput, Modal, Platform, KeyboardAvoidingView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import * as ImagePicker from "expo-image-picker";
import { calibrationApi } from "../../../../api/calibration";
import { useAuth } from "../../../../auth/AuthProvider";
import { can } from "../../../../auth/permissions";
import { Card } from "../../../../components/ui/Card";
import { Input } from "../../../../components/ui/Input";
import { Button } from "../../../../components/ui/Button";
import { CalibrationPoint } from "../../../../types/api";

const schema = z.object({
  performed_at: z.string().min(1, "Data é obrigatória"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type DraftPoint = {
  point_value: string;
  criterion: string;
  error_tolerance: string;
  sort_order: number;
};

function pointFromDraft(d: DraftPoint, i: number) {
  return {
    point_value: d.point_value,
    criterion: d.criterion,
    error_tolerance: d.error_tolerance !== "" ? Number(d.error_tolerance) : null,
    sort_order: i + 1,
  };
}

function draftFromPoint(p: CalibrationPoint): DraftPoint {
  return {
    point_value: p.point_value,
    criterion: p.criterion,
    error_tolerance: p.error_tolerance != null ? String(p.error_tolerance) : "",
    sort_order: p.sort_order,
  };
}

export default function CalibrationScreen() {
  const { id: equipmentId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [pendingCertUri, setPendingCertUri] = useState<{ uri: string; name: string; type: string } | null>(null);

  // Calibration points editing
  const [pointsModalVisible, setPointsModalVisible] = useState(false);
  const [draftPoints, setDraftPoints] = useState<DraftPoint[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["calibration-records", equipmentId],
    queryFn: () => calibrationApi.getRecords(equipmentId),
  });

  const { data: pointsData, refetch: refetchPoints } = useQuery({
    queryKey: ["calibration-points", equipmentId],
    queryFn: () => calibrationApi.getPoints(equipmentId),
  });

  const { data: templatesData } = useQuery({
    queryKey: ["calibration-templates"],
    queryFn: () => calibrationApi.listTemplates(),
    enabled: showForm,
  });

  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      performed_at: new Date().toISOString().split("T")[0],
    },
  });

  const addMutation = useMutation({
    mutationFn: (vals: FormValues) =>
      calibrationApi.addRecord(equipmentId, {
        performed_at: vals.performed_at,
        notes: vals.notes ?? null,
        template_doc_id: selectedTemplateId,
      }),
    onSuccess: async (res) => {
      const createdId = (res as any).data.id;

      if (pendingCertUri && createdId) {
        setUploadingCert(true);
        try {
          await calibrationApi.uploadCertificate(
            equipmentId,
            createdId,
            pendingCertUri.uri,
            pendingCertUri.name,
            pendingCertUri.type,
          );
        } catch {
          Alert.alert("Aviso", "Registro salvo, mas o certificado não pôde ser enviado.");
        } finally {
          setUploadingCert(false);
          setPendingCertUri(null);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["calibration-records", equipmentId] });
      queryClient.invalidateQueries({ queryKey: ["equipment", equipmentId] });
      reset();
      setSelectedTemplateId(null);
      setShowForm(false);
      Alert.alert("Sucesso", "Registro de calibração salvo!");
    },
    onError: (err: any) => Alert.alert("Erro", err.message || "Não foi possível salvar o registro."),
  });

  const setPointsMutation = useMutation({
    mutationFn: (pts: ReturnType<typeof pointFromDraft>[]) =>
      calibrationApi.setPoints(equipmentId, pts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calibration-points", equipmentId] });
      setPointsModalVisible(false);
      Alert.alert("Sucesso", "Pontos de calibração atualizados!");
    },
    onError: (err: any) => Alert.alert("Erro", err.message || "Não foi possível salvar os pontos."),
  });

  const selectCertificate = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permissão negada", "Necessitamos acesso à galeria.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets.length > 0) {
      const sel = result.assets[0];
      const name = sel.fileName ?? `certificate_${Date.now()}.pdf`;
      const ext = /\.(\w+)$/.exec(name)?.[1] ?? "jpg";
      setPendingCertUri({ uri: sel.uri, name, type: `image/${ext}` });
    }
  };

  const openPointsModal = () => {
    const pts = pointsData?.data ?? [];
    setDraftPoints(pts.length > 0 ? pts.map(draftFromPoint) : [{ point_value: "", criterion: "", error_tolerance: "", sort_order: 1 }]);
    setPointsModalVisible(true);
  };

  const addDraftPoint = () => {
    setDraftPoints((prev) => [...prev, { point_value: "", criterion: "", error_tolerance: "", sort_order: prev.length + 1 }]);
  };

  const removeDraftPoint = (i: number) => {
    setDraftPoints((prev) => prev.filter((_, idx) => idx !== i));
  };

  const updateDraftPoint = (i: number, field: keyof DraftPoint, value: string) => {
    setDraftPoints((prev) => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
  };

  const savePoints = () => {
    const invalid = draftPoints.some((p) => !p.point_value.trim() || !p.criterion.trim());
    if (invalid) {
      Alert.alert("Atenção", "Todos os pontos precisam de valor e critério.");
      return;
    }
    setPointsMutation.mutate(draftPoints.map(pointFromDraft));
  };

  const records = data?.data ?? [];
  const points = pointsData?.data ?? [];

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backAction}>
          <Ionicons name="arrow-back" size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Calibrações</Text>
        {can(user, "calibration:register") && (
          <TouchableOpacity onPress={() => setShowForm((v) => !v)} style={s.addBtn}>
            <Ionicons name={showForm ? "close" : "add"} size={22} color="#6366F1" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#6366F1" />}
      >
        {/* Calibration Points */}
        <Card style={s.pointsCard}>
          <View style={s.pointsHeader}>
            <Text style={s.sectionTitle}>Pontos de Calibração ({points.length})</Text>
            {can(user, "equipment:update") && (
              <TouchableOpacity onPress={openPointsModal} style={s.editPointsBtn}>
                <Ionicons name="create-outline" size={16} color="#818CF8" />
                <Text style={s.editPointsBtnText}>Gerenciar</Text>
              </TouchableOpacity>
            )}
          </View>
          {points.length === 0 ? (
            <Text style={s.noPointsText}>Nenhum ponto definido.</Text>
          ) : (
            points.map((pt, i) => (
              <View key={pt.id} style={[s.pointRow, i === points.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={s.pointIndex}>
                  <Text style={s.pointIndexText}>{i + 1}</Text>
                </View>
                <View style={s.pointMeta}>
                  <Text style={s.pointName}>{pt.point_value}</Text>
                  <Text style={s.pointDesc}>{pt.criterion}</Text>
                </View>
                {pt.error_tolerance != null && (
                  <Text style={s.pointUnit}>±{pt.error_tolerance}</Text>
                )}
              </View>
            ))
          )}
        </Card>

        {/* New Record Form */}
        {showForm && (
          <Card style={s.formCard}>
            <Text style={s.sectionTitle}>Registrar Calibração</Text>

            <Controller
              control={control}
              name="performed_at"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input label="Data de Realização *" placeholder="AAAA-MM-DD" onBlur={onBlur} onChangeText={onChange} value={value} error={errors.performed_at?.message} />
              )}
            />
            <Controller
              control={control}
              name="notes"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input label="Observações" placeholder="Observações adicionais..." onBlur={onBlur} onChangeText={onChange} value={value ?? ""} multiline numberOfLines={3} style={{ height: 80, textAlignVertical: "top", paddingTop: 10 }} />
              )}
            />

            {/* Template picker */}
            {templatesData?.data && templatesData.data.length > 0 && (
              <View style={s.templateSection}>
                <Text style={s.templateLabel}>Template de Calibração</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.templateScroll}>
                  <TouchableOpacity
                    onPress={() => setSelectedTemplateId(null)}
                    style={[s.templateChip, !selectedTemplateId && s.templateChipActive]}
                  >
                    <Text style={[s.templateChipText, !selectedTemplateId && s.templateChipTextActive]}>Nenhum</Text>
                  </TouchableOpacity>
                  {templatesData.data.map((tpl) => (
                    <TouchableOpacity
                      key={tpl.id}
                      onPress={() => setSelectedTemplateId(tpl.id)}
                      style={[s.templateChip, selectedTemplateId === tpl.id && s.templateChipActive]}
                    >
                      <Ionicons name="document-outline" size={12} color={selectedTemplateId === tpl.id ? "#FFFFFF" : "#64748B"} />
                      <Text style={[s.templateChipText, selectedTemplateId === tpl.id && s.templateChipTextActive]} numberOfLines={1}>{tpl.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Certificate upload */}
            <TouchableOpacity onPress={selectCertificate} style={s.certUploadBtn}>
              <Ionicons name="document-attach-outline" size={18} color={pendingCertUri ? "#34D399" : "#64748B"} />
              <Text style={[s.certUploadText, pendingCertUri && { color: "#34D399" }]}>
                {pendingCertUri ? `✓ ${pendingCertUri.name}` : "Anexar Certificado (PDF/Imagem)"}
              </Text>
            </TouchableOpacity>

            <Button
              title={uploadingCert ? "Enviando certificado..." : "Salvar Registro"}
              onPress={handleSubmit((d: any) => addMutation.mutate(d))}
              loading={addMutation.isPending || uploadingCert}
              style={{ marginTop: 12 }}
            />
          </Card>
        )}

        {/* Records List */}
        {isLoading ? (
          <View style={s.center}><ActivityIndicator color="#6366F1" /></View>
        ) : isError ? (
          <View style={s.center}>
            <Text style={s.errorText}>Erro ao carregar registros.</Text>
          </View>
        ) : records.length === 0 ? (
          <Card style={s.emptyCard}>
            <Ionicons name="flask-outline" size={40} color="#475569" />
            <Text style={s.emptyText}>Nenhum registro de calibração.</Text>
          </Card>
        ) : (
          records.map((rec) => (
            <Card key={rec.id} style={s.recordCard}>
              <View style={s.recordTop}>
                <Text style={s.recordDate}>{new Date(rec.performed_at).toLocaleDateString("pt-BR")}</Text>
                {rec.certificate_storage_path && (
                  <View style={s.certBadge}>
                    <Ionicons name="document-attach-outline" size={12} color="#34D399" />
                    <Text style={s.certBadgeText}>Certificado</Text>
                  </View>
                )}
              </View>

              <View style={s.recordMeta}>
                {rec.performer && (
                  <View style={s.recordMetaRow}>
                    <Ionicons name="person-outline" size={13} color="#64748B" />
                    <Text style={s.recordMetaText}>{rec.performer.name}</Text>
                  </View>
                )}
                {rec.template_doc && (
                  <View style={s.recordMetaRow}>
                    <Ionicons name="document-outline" size={13} color="#64748B" />
                    <Text style={s.recordMetaText}>{rec.template_doc.name}</Text>
                  </View>
                )}
              </View>

              {rec.notes && (
                <Text style={s.recordNotes}>{rec.notes}</Text>
              )}
            </Card>
          ))
        )}
      </ScrollView>

      {/* Edit Points Modal */}
      <Modal visible={pointsModalVisible} animationType="slide" transparent onRequestClose={() => setPointsModalVisible(false)}>
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Pontos de Calibração</Text>
              <TouchableOpacity onPress={() => setPointsModalVisible(false)}>
                <Ionicons name="close" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={s.modalScroll} keyboardShouldPersistTaps="handled">
              {draftPoints.map((pt, i) => (
                <View key={i} style={s.draftRow}>
                  <View style={s.draftIndex}>
                    <Text style={s.draftIndexText}>{i + 1}</Text>
                  </View>
                  <View style={s.draftFields}>
                    <TextInput
                      value={pt.point_value}
                      onChangeText={(v) => updateDraftPoint(i, "point_value", v)}
                      placeholder="Valor do ponto"
                      placeholderTextColor="#5E636E"
                      style={s.draftInput}
                    />
                    <TextInput
                      value={pt.criterion}
                      onChangeText={(v) => updateDraftPoint(i, "criterion", v)}
                      placeholder="Critério"
                      placeholderTextColor="#5E636E"
                      style={s.draftInput}
                    />
                    <TextInput
                      value={pt.error_tolerance}
                      onChangeText={(v) => updateDraftPoint(i, "error_tolerance", v)}
                      placeholder="Tolerância (opcional)"
                      placeholderTextColor="#5E636E"
                      keyboardType="decimal-pad"
                      style={s.draftInput}
                    />
                  </View>
                  <TouchableOpacity onPress={() => removeDraftPoint(i)} style={s.draftDeleteBtn}>
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity onPress={addDraftPoint} style={s.addPointBtn}>
                <Ionicons name="add" size={18} color="#818CF8" />
                <Text style={s.addPointBtnText}>Adicionar Ponto</Text>
              </TouchableOpacity>

              <Button
                title="Salvar Pontos"
                onPress={savePoints}
                loading={setPointsMutation.isPending}
                style={s.modalSaveBtn}
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F0F10" },
  header: { height: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#111214", borderBottomWidth: 1, borderBottomColor: "#2E3033", paddingHorizontal: 16, paddingTop: 12 },
  backAction: { padding: 4 },
  headerTitle: { color: "#F8FAFC", fontSize: 16, fontWeight: "700", flex: 1, marginLeft: 12 },
  addBtn: { padding: 8 },
  scroll: { padding: 16, paddingBottom: 48 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 },
  pointsCard: { backgroundColor: "#151618", marginBottom: 16 },
  pointsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  editPointsBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  editPointsBtnText: { color: "#818CF8", fontSize: 13, fontWeight: "600" },
  noPointsText: { color: "#475569", fontSize: 13, textAlign: "center", paddingVertical: 8 },
  pointRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#212225" },
  pointIndex: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#1A1A2E", justifyContent: "center", alignItems: "center", marginRight: 12 },
  pointIndexText: { color: "#818CF8", fontSize: 11, fontWeight: "700" },
  pointMeta: { flex: 1 },
  pointName: { color: "#E2E8F0", fontSize: 13, fontWeight: "600" },
  pointDesc: { color: "#64748B", fontSize: 11, marginTop: 1 },
  pointUnit: { color: "#64748B", fontSize: 12 },
  formCard: { backgroundColor: "#151618", marginBottom: 20 },
  templateSection: { marginBottom: 12 },
  templateLabel: { fontSize: 13, color: "#94A3B8", fontWeight: "500", marginBottom: 8 },
  templateScroll: { gap: 8 },
  templateChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, backgroundColor: "#1C1D20", borderWidth: 1, borderColor: "#2E3033", marginRight: 8 },
  templateChipActive: { backgroundColor: "#6366F1", borderColor: "#6366F1" },
  templateChipText: { color: "#64748B", fontSize: 12, fontWeight: "500" },
  templateChipTextActive: { color: "#FFFFFF", fontWeight: "700" },
  certUploadBtn: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#111214", borderRadius: 8, borderWidth: 1, borderColor: "#2E3033", borderStyle: "dashed", padding: 12, marginTop: 8 },
  certUploadText: { color: "#64748B", fontSize: 13 },
  center: { paddingVertical: 32, alignItems: "center" },
  errorText: { color: "#EF4444", fontSize: 14 },
  emptyCard: { alignItems: "center", paddingVertical: 32, backgroundColor: "#151618" },
  emptyText: { color: "#475569", fontSize: 13, marginTop: 10 },
  recordCard: { backgroundColor: "#151618", marginBottom: 12 },
  recordTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  recordDate: { color: "#E2E8F0", fontSize: 14, fontWeight: "600" },
  certBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#052E16", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "#16A34A" },
  certBadgeText: { color: "#34D399", fontSize: 11, fontWeight: "600" },
  recordMeta: { gap: 6, marginBottom: 8 },
  recordMetaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  recordMetaText: { color: "#94A3B8", fontSize: 13 },
  recordNotes: { color: "#64748B", fontSize: 12, fontStyle: "italic", borderTopWidth: 1, borderTopColor: "#212225", paddingTop: 8 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#111214", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "85%" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 18, borderBottomWidth: 1, borderBottomColor: "#2E3033" },
  modalTitle: { fontSize: 16, fontWeight: "700", color: "#F8FAFC" },
  modalScroll: { padding: 16 },
  draftRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#212225" },
  draftIndex: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#1A1A2E", justifyContent: "center", alignItems: "center", marginTop: 10 },
  draftIndexText: { color: "#818CF8", fontSize: 11, fontWeight: "700" },
  draftFields: { flex: 1, gap: 6 },
  draftInput: { backgroundColor: "#0F0F10", borderWidth: 1, borderColor: "#2E3033", borderRadius: 8, paddingHorizontal: 12, height: 40, color: "#F8FAFC", fontSize: 13 },
  draftDeleteBtn: { padding: 8, marginTop: 4 },
  addPointBtn: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center", paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: "#312E81", backgroundColor: "#1A1A2E", marginBottom: 16 },
  addPointBtnText: { color: "#818CF8", fontSize: 14, fontWeight: "600" },
  modalSaveBtn: { marginBottom: 8 },
});
