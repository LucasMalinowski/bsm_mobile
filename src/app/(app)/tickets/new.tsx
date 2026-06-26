import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Modal, TextInput,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { ticketsApi } from "../../../api/tickets";
import { equipmentApi } from "../../../api/equipment";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { useAuth } from "../../../auth/AuthProvider";

const schema = z.object({
  title: z.string().min(3, "Título deve ter no mínimo 3 caracteres"),
  description: z.string().min(1, "Descrição é obrigatória"),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  type: z.enum(["maintenance", "calibration", "repair", "inspection", "other"]).default("maintenance"),
  is_support_request: z.boolean().default(false),
  photo_url: z.string().nullable().optional(),
});

type FormValues = z.infer<typeof schema>;

const PRIORITIES = [
  { label: "Baixa", value: "low" },
  { label: "Média", value: "medium" },
  { label: "Alta", value: "high" },
  { label: "Crítica", value: "critical" },
] as const;

const TYPES = [
  { label: "Manutenção", value: "maintenance" },
  { label: "Calibração", value: "calibration" },
  { label: "Reparo", value: "repair" },
  { label: "Inspeção", value: "inspection" },
  { label: "Outro", value: "other" },
] as const;

export default function NewTicketScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ equipment_id?: string }>();
  const queryClient = useQueryClient();
  const { user, activeCompanyId } = useAuth();
  const companyId = user?.role === "super_admin" ? activeCompanyId ?? undefined : undefined;
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [equipmentModalVisible, setEquipmentModalVisible] = useState(false);
  const [equipmentSearch, setEquipmentSearch] = useState("");
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);
  const [selectedEquipmentName, setSelectedEquipmentName] = useState<string | null>(null);

  const { data: equipmentData, isLoading: equipmentLoading } = useQuery({
    queryKey: ["equipment-picker", equipmentSearch, companyId],
    queryFn: () => equipmentApi.list({ search: equipmentSearch, limit: 20, company_id: companyId }),
    enabled: equipmentModalVisible,
  });

  const { control, handleSubmit, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: { title: "", description: "", priority: "medium", type: "maintenance", is_support_request: false },
  });

  const createMutation = useMutation({
    mutationFn: (data: FormValues) =>
      ticketsApi.create({
        ...data,
        equipment_id: selectedEquipmentId ?? params.equipment_id ?? null,
        company_id: companyId,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      Alert.alert("Chamado Aberto", "Seu chamado foi registrado com sucesso!");
      router.replace(`/(app)/tickets/${res.data.id}`);
    },
    onError: (err: any) => Alert.alert("Erro", err.message || "Não foi possível criar o chamado."),
  });

  const selectPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permissão negada", "Necessitamos de acesso à galeria."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8 });
    if (!result.canceled && result.assets.length > 0) {
      const sel = result.assets[0];
      setPhotoUri(sel.uri);
      setUploadingPhoto(true);
      try {
        const name = sel.fileName || `ticket_${Date.now()}.jpg`;
        const ext = /\.(\w+)$/.exec(name)?.[1] ?? "jpg";
        const res = await ticketsApi.uploadPhoto(sel.uri, name, `image/${ext}`);
        setValue("photo_url", res.url);
      } catch (e: any) {
        Alert.alert("Erro", e.message || "Falha ao enviar foto.");
        setPhotoUri(null);
      } finally {
        setUploadingPhoto(false);
      }
    }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={[s.header, { paddingTop: 12 + insets.top, minHeight: 64 + insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backAction}>
          <Ionicons name="arrow-back" size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Novo Chamado</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* Photo */}
        <TouchableOpacity onPress={selectPhoto} style={s.photoBox}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={s.photoImage} />
          ) : (
            <>
              <Ionicons name="camera-outline" size={28} color="#64748B" />
              <Text style={s.photoText}>Anexar Foto (Opcional)</Text>
            </>
          )}
          {uploadingPhoto && (
            <View style={s.uploadOverlay}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={s.uploadText}>Enviando...</Text>
            </View>
          )}
        </TouchableOpacity>

        {params.equipment_id ? (
          <View style={s.equipmentBanner}>
            <Ionicons name="cube" size={16} color="#818CF8" />
            <Text style={s.equipmentBannerText}>Chamado vinculado ao equipamento selecionado</Text>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setEquipmentModalVisible(true)} style={s.equipmentPicker} activeOpacity={0.7}>
            <Ionicons name="cube-outline" size={18} color={selectedEquipmentId ? "#818CF8" : "#64748B"} />
            <Text style={[s.equipmentPickerText, selectedEquipmentId && { color: "#E2E8F0" }]}>
              {selectedEquipmentName ?? "Vincular Equipamento (Opcional)"}
            </Text>
            {selectedEquipmentId ? (
              <TouchableOpacity onPress={() => { setSelectedEquipmentId(null); setSelectedEquipmentName(null); }}>
                <Ionicons name="close-circle" size={18} color="#475569" />
              </TouchableOpacity>
            ) : (
              <Ionicons name="chevron-forward" size={16} color="#475569" />
            )}
          </TouchableOpacity>
        )}

        <Controller
          control={control}
          name="title"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input label="Título *" placeholder="Descreva brevemente o problema..." onBlur={onBlur} onChangeText={onChange} value={value} error={errors.title?.message} />
          )}
        />

        <Controller
          control={control}
          name="description"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input label="Descrição Detalhada *" placeholder="Descreva o problema em detalhes..." onBlur={onBlur} onChangeText={onChange} value={value} error={errors.description?.message} multiline numberOfLines={5} style={{ height: 120, textAlignVertical: "top", paddingTop: 12 }} />
          )}
        />

        <Text style={s.fieldLabel}>Prioridade</Text>
        <Controller
          control={control}
          name="priority"
          render={({ field: { onChange, value } }) => (
            <View style={s.chips}>
              {PRIORITIES.map((p) => (
                <TouchableOpacity key={p.value} onPress={() => onChange(p.value)} style={[s.chip, value === p.value && s.chipActive]}>
                  <Text style={[s.chipText, value === p.value && s.chipTextActive]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        />

        <Text style={s.fieldLabel}>Tipo de Chamado</Text>
        <Controller
          control={control}
          name="type"
          render={({ field: { onChange, value } }) => (
            <View style={s.chips}>
              {TYPES.map((t) => (
                <TouchableOpacity key={t.value} onPress={() => onChange(t.value)} style={[s.chip, value === t.value && s.chipActive]}>
                  <Text style={[s.chipText, value === t.value && s.chipTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        />

        <Controller
          control={control}
          name="is_support_request"
          render={({ field: { onChange, value } }) => (
            <TouchableOpacity onPress={() => onChange(!value)} style={s.toggleRow} activeOpacity={0.7}>
              <View style={s.toggleTextBlock}>
                <Text style={s.fieldLabel}>Solicitação de Suporte</Text>
                <Text style={s.toggleHint}>Requer suporte técnico especializado</Text>
              </View>
              <View style={[s.toggleBox, value && s.toggleBoxActive]}>
                {value && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
              </View>
            </TouchableOpacity>
          )}
        />

        <Button
          title="Abrir Chamado"
          onPress={handleSubmit((d: any) => createMutation.mutate(d))}
          loading={createMutation.isPending}
          style={s.submitBtn}
        />
      </ScrollView>

      {/* Equipment Picker Modal */}
      <Modal visible={equipmentModalVisible} animationType="slide" transparent onRequestClose={() => setEquipmentModalVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Selecionar Equipamento</Text>
              <TouchableOpacity onPress={() => setEquipmentModalVisible(false)}>
                <Ionicons name="close" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <View style={s.modalSearchRow}>
              <Ionicons name="search-outline" size={16} color="#64748B" style={s.searchIcon} />
              <TextInput
                value={equipmentSearch}
                onChangeText={setEquipmentSearch}
                placeholder="Buscar equipamento..."
                placeholderTextColor="#5E636E"
                style={s.searchInput}
                autoFocus
              />
            </View>

            <ScrollView style={s.pickerList} keyboardShouldPersistTaps="handled">
              {equipmentLoading ? (
                <ActivityIndicator color="#6366F1" style={{ marginTop: 24 }} />
              ) : (equipmentData?.data ?? []).length === 0 ? (
                <Text style={s.pickerEmpty}>Nenhum equipamento encontrado.</Text>
              ) : (
                (equipmentData?.data ?? []).map((eq) => (
                  <TouchableOpacity
                    key={eq.id}
                    style={s.pickerItem}
                    onPress={() => {
                      setSelectedEquipmentId(eq.id);
                      setSelectedEquipmentName(`${eq.name} (${eq.internal_code})`);
                      setEquipmentModalVisible(false);
                    }}
                  >
                    <View style={s.pickerItemIcon}>
                      <Ionicons name="cube-outline" size={18} color="#818CF8" />
                    </View>
                    <View style={s.pickerItemMeta}>
                      <Text style={s.pickerItemName}>{eq.name}</Text>
                      <Text style={s.pickerItemCode}>{eq.internal_code}</Text>
                    </View>
                    {selectedEquipmentId === eq.id && (
                      <Ionicons name="checkmark-circle" size={20} color="#6366F1" />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F0F10" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#111214", borderBottomWidth: 1, borderBottomColor: "#2E3033", paddingHorizontal: 16, paddingBottom: 12 },
  backAction: { padding: 4 },
  headerTitle: { color: "#F8FAFC", fontSize: 16, fontWeight: "700" },
  scroll: { padding: 16, paddingBottom: 40 },
  photoBox: { height: 140, backgroundColor: "#111214", borderRadius: 12, borderWidth: 1, borderColor: "#2E3033", borderStyle: "dashed", justifyContent: "center", alignItems: "center", overflow: "hidden", marginBottom: 16 },
  photoImage: { width: "100%", height: "100%" },
  photoText: { color: "#64748B", fontSize: 13, marginTop: 8 },
  uploadOverlay: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(15,15,16,0.8)", justifyContent: "center", alignItems: "center" },
  uploadText: { color: "#FFFFFF", fontSize: 12, marginTop: 8 },
  equipmentBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#1A1A2E", borderRadius: 8, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "#312E81" },
  equipmentBannerText: { color: "#818CF8", fontSize: 13, fontWeight: "500" },
  fieldLabel: { fontSize: 13, color: "#94A3B8", fontWeight: "500", marginTop: 12, marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: "#151618", borderWidth: 1, borderColor: "#2E3033" },
  chipActive: { backgroundColor: "#6366F1", borderColor: "#6366F1" },
  chipText: { fontSize: 13, color: "#94A3B8", fontWeight: "500" },
  chipTextActive: { color: "#FFFFFF", fontWeight: "600" },
  submitBtn: { marginTop: 24 },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#151618", borderRadius: 10, borderWidth: 1, borderColor: "#2E3033", padding: 14, marginBottom: 16 },
  toggleTextBlock: { flex: 1, marginRight: 12 },
  toggleHint: { fontSize: 12, color: "#475569", marginTop: 2 },
  toggleBox: { width: 28, height: 28, borderRadius: 6, borderWidth: 2, borderColor: "#2E3033", backgroundColor: "#0F0F10", justifyContent: "center", alignItems: "center" },
  toggleBoxActive: { backgroundColor: "#6366F1", borderColor: "#6366F1" },
  equipmentPicker: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#151618", borderRadius: 10, borderWidth: 1, borderColor: "#2E3033", padding: 14, marginBottom: 12 },
  equipmentPickerText: { flex: 1, fontSize: 14, color: "#64748B" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#111214", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "75%" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 18, borderBottomWidth: 1, borderBottomColor: "#2E3033" },
  modalTitle: { fontSize: 16, fontWeight: "700", color: "#F8FAFC" },
  modalSearchRow: { flexDirection: "row", alignItems: "center", margin: 12, backgroundColor: "#0F0F10", borderRadius: 10, borderWidth: 1, borderColor: "#2E3033", paddingHorizontal: 12 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 44, color: "#F8FAFC", fontSize: 14 },
  pickerList: { maxHeight: 360 },
  pickerEmpty: { textAlign: "center", color: "#475569", fontSize: 13, paddingVertical: 24 },
  pickerItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#212225" },
  pickerItemIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: "#1A1A2E", justifyContent: "center", alignItems: "center", marginRight: 12 },
  pickerItemMeta: { flex: 1 },
  pickerItemName: { color: "#E2E8F0", fontSize: 14, fontWeight: "600" },
  pickerItemCode: { color: "#64748B", fontSize: 12, marginTop: 2 },
});
