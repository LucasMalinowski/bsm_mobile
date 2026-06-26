import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Switch, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { equipmentApi } from "../../../api/equipment";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../../../contexts/ThemeContext";
import type { Colors } from "../../../constants/colors";

const schema = z.object({
  internal_code: z.string().min(1, "Código interno é obrigatório"),
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  category_name: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  serial_number: z.string().optional(),
  location: z.string().optional(),
  acquisition_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato deve ser AAAA-MM-DD").or(z.literal("")).optional(),
  acquisition_cost: z.string().optional(),
  status: z.enum(["active", "inactive", "under_maintenance", "calibration", "retired"]),
  requires_calibration: z.boolean().default(true),
  calibration_periodicity: z.enum(["semestral", "anual", "bi_anual", "tri_anual", "outro"]).nullable().optional(),
  notes: z.string().optional(),
  image_url: z.string().nullable().optional(),
});

type FormValues = z.infer<typeof schema>;

const PERIODICITIES = [
  { label: "Semestral", value: "semestral" },
  { label: "Anual", value: "anual" },
  { label: "Bi-Anual", value: "bi_anual" },
  { label: "Tri-Anual", value: "tri_anual" },
  { label: "Outro", value: "outro" },
] as const;

const STATUSES = [
  { label: "Ativo", value: "active" },
  { label: "Inativo", value: "inactive" },
  { label: "Sob Manutenção", value: "under_maintenance" },
  { label: "Sob Calibração", value: "calibration" },
  { label: "Aposentado", value: "retired" },
] as const;

export default function EditEquipmentScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { colors: c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const { data: eqData, isLoading: loadingDetail, isError } = useQuery({
    queryKey: ["equipment", id],
    queryFn: () => equipmentApi.get(id),
  });

  const { control, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
  });

  useEffect(() => {
    if (eqData?.data) {
      const eq = eqData.data;
      reset({
        internal_code: eq.internal_code,
        name: eq.name,
        brand: eq.brand || "",
        model: eq.model || "",
        serial_number: eq.serial_number || "",
        location: eq.location || "",
        acquisition_date: eq.acquisition_date || "",
        acquisition_cost: eq.acquisition_cost != null ? String(eq.acquisition_cost) : "",
        status: eq.status,
        requires_calibration: eq.requires_calibration,
        calibration_periodicity: eq.calibration_periodicity || "anual",
        notes: eq.notes || "",
        image_url: eq.image_url,
        category_name: eq.category?.name || "",
      });
      if (eq.image_url) setPhotoUri(eq.image_url);
    }
  }, [eqData, reset]);

  const requiresCalibration = watch("requires_calibration");

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => {
      const payload = {
        ...data,
        category_name: data.category_name || undefined,
        acquisition_date: data.acquisition_date || null,
        acquisition_cost: data.acquisition_cost ? Number(data.acquisition_cost) : null,
        calibration_periodicity: data.requires_calibration ? data.calibration_periodicity : null,
      };
      return equipmentApi.update(id, payload as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment", id] });
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      Alert.alert("Sucesso", "Equipamento editado com sucesso!");
      router.back();
    },
    onError: (err: any) => Alert.alert("Erro", err.message || "Erro ao salvar alterações."),
  });

  const onSubmit = (data: FormValues) => updateMutation.mutate(data);

  const selectPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permissão negada", "Necessitamos de acesso à galeria para anexar fotos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8 });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const selected = result.assets[0];
      setPhotoUri(selected.uri);
      setUploadingPhoto(true);
      try {
        const filename = selected.fileName || `eq_${Date.now()}.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const mimeType = match ? `image/${match[1]}` : `image/jpeg`;
        const uploadRes = await equipmentApi.uploadPhoto(selected.uri, filename, mimeType);
        setValue("image_url", uploadRes.url);
        Alert.alert("Sucesso", "Nova foto anexada com sucesso!");
      } catch (uploadErr: any) {
        Alert.alert("Erro de Anexo", uploadErr.message || "Não foi possível carregar a imagem para o servidor.");
        setPhotoUri(eqData?.data?.image_url || null);
      } finally {
        setUploadingPhoto(false);
      }
    }
  };

  if (loadingDetail) {
    return <View style={s.centerContainer}><ActivityIndicator size="large" color={c.primary} /></View>;
  }

  if (isError) {
    return (
      <View style={s.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={c.error} />
        <Text style={s.errorText}>Erro ao carregar detalhes para edição.</Text>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backBtnText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.container}>
      <View style={[s.header, { paddingTop: 12 + insets.top, minHeight: 64 + insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backAction}>
          <Ionicons name="arrow-back" size={24} color={c.headerText} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Editar Equipamento</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.scrollContainer} keyboardShouldPersistTabs="handled">
        <TouchableOpacity onPress={selectPhoto} style={s.photoContainer}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={s.selectedPhoto} />
          ) : (
            <View style={s.photoPlaceholder}>
              <Ionicons name="camera-outline" size={32} color={c.textMuted} />
              <Text style={s.photoText}>Alterar Foto do Equipamento</Text>
            </View>
          )}
          {uploadingPhoto && (
            <View style={s.uploadOverlay}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={s.uploadOverlayText}>Enviando foto...</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={s.form}>
          <Controller control={control} name="internal_code" render={({ field: { onChange, onBlur, value } }) => (
            <Input label="Código Interno *" placeholder="Ex: EQ-042" onBlur={onBlur} onChangeText={onChange} value={value} error={errors.internal_code?.message} autoCapitalize="characters" />
          )} />
          <Controller control={control} name="name" render={({ field: { onChange, onBlur, value } }) => (
            <Input label="Nome do Equipamento *" placeholder="Ex: Balança de Precisão" onBlur={onBlur} onChangeText={onChange} value={value} error={errors.name?.message} />
          )} />
          <Controller control={control} name="category_name" render={({ field: { onChange, onBlur, value } }) => (
            <Input label="Categoria" placeholder="Ex: Medição, Elétrico..." onBlur={onBlur} onChangeText={onChange} value={value ?? ""} />
          )} />

          <View style={s.row}>
            <View style={s.col}>
              <Controller control={control} name="brand" render={({ field: { onChange, onBlur, value } }) => (
                <Input label="Marca" placeholder="Mettler" onBlur={onBlur} onChangeText={onChange} value={value} error={errors.brand?.message} />
              )} />
            </View>
            <View style={s.col}>
              <Controller control={control} name="model" render={({ field: { onChange, onBlur, value } }) => (
                <Input label="Modelo" placeholder="XP204" onBlur={onBlur} onChangeText={onChange} value={value} error={errors.model?.message} />
              )} />
            </View>
          </View>

          <Controller control={control} name="serial_number" render={({ field: { onChange, onBlur, value } }) => (
            <Input label="Número de Série" placeholder="Ex: SN987654" onBlur={onBlur} onChangeText={onChange} value={value} error={errors.serial_number?.message} />
          )} />
          <Controller control={control} name="location" render={({ field: { onChange, onBlur, value } }) => (
            <Input label="Localização / Setor" placeholder="Ex: Laboratório de P&D" onBlur={onBlur} onChangeText={onChange} value={value} error={errors.location?.message} />
          )} />
          <Controller control={control} name="acquisition_date" render={({ field: { onChange, onBlur, value } }) => (
            <Input label="Data de Aquisição" placeholder="AAAA-MM-DD (Ex: 2025-10-15)" onBlur={onBlur} onChangeText={onChange} value={value} error={errors.acquisition_date?.message} />
          )} />
          <Controller control={control} name="acquisition_cost" render={({ field: { onChange, onBlur, value } }) => (
            <Input label="Custo de Aquisição (R$)" placeholder="Ex: 15000.00" onBlur={onBlur} onChangeText={onChange} value={value ?? ""} keyboardType="decimal-pad" />
          )} />

          <Text style={s.fieldLabel}>Status Operacional</Text>
          <Controller control={control} name="status" render={({ field: { onChange, value } }) => (
            <View style={s.selectorContainer}>
              {STATUSES.map((st) => {
                const isSelected = value === st.value;
                return (
                  <TouchableOpacity key={st.value} onPress={() => onChange(st.value)} style={[s.selectorChip, isSelected ? s.selectorChipActive : null]}>
                    <Text style={[s.selectorText, isSelected ? s.selectorTextActive : null]}>{st.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )} />

          <View style={s.switchRow}>
            <View>
              <Text style={s.switchLabel}>Requer Calibração Periódica?</Text>
              <Text style={s.switchDesc}>Indica se este equipamento passará por calibrações regulares.</Text>
            </View>
            <Controller control={control} name="requires_calibration" render={({ field: { onChange, value } }) => (
              <Switch value={value} onValueChange={onChange} trackColor={{ false: c.surface2, true: c.primary }} thumbColor="#FFFFFF" />
            )} />
          </View>

          {requiresCalibration && (
            <View style={s.periodicitySection}>
              <Text style={s.fieldLabel}>Periodicidade de Calibração</Text>
              <Controller control={control} name="calibration_periodicity" render={({ field: { onChange, value } }) => (
                <View style={s.selectorContainer}>
                  {PERIODICITIES.map((p) => {
                    const isSelected = value === p.value;
                    return (
                      <TouchableOpacity key={p.value} onPress={() => onChange(p.value)} style={[s.selectorChip, isSelected ? s.selectorChipActive : null]}>
                        <Text style={[s.selectorText, isSelected ? s.selectorTextActive : null]}>{p.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )} />
            </View>
          )}

          <Controller control={control} name="notes" render={({ field: { onChange, onBlur, value } }) => (
            <Input label="Notas Observações" placeholder="Digite detalhes ou notas observações adicionais..." onBlur={onBlur} onChangeText={onChange} value={value} error={errors.notes?.message} multiline numberOfLines={4} style={[s.notesInput, { height: 100, textAlignVertical: "top" }]} />
          )} />

          <Button title="Salvar Alterações" onPress={handleSubmit(onSubmit as any)} loading={updateMutation.isPending} style={s.submitBtn} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    centerContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: c.bg, padding: 24 },
    errorText: { color: c.error, fontSize: 15, marginTop: 12, textAlign: "center", marginBottom: 16 },
    backBtn: { backgroundColor: c.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
    backBtnText: { color: "#FFFFFF", fontWeight: "600" },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      backgroundColor: c.header, borderBottomWidth: 1, borderBottomColor: c.border,
      paddingHorizontal: 16, paddingBottom: 12,
    },
    backAction: { padding: 4 },
    headerTitle: { color: c.headerText, fontSize: 16, fontWeight: "700" },
    scrollContainer: { padding: 16, paddingBottom: 40 },
    photoContainer: {
      height: 160, backgroundColor: c.surface2, borderRadius: 12, borderWidth: 1,
      borderColor: c.border, borderStyle: "dashed", justifyContent: "center",
      alignItems: "center", overflow: "hidden", marginBottom: 20,
    },
    selectedPhoto: { width: "100%", height: "100%" },
    photoPlaceholder: { justifyContent: "center", alignItems: "center" },
    photoText: { color: c.textMuted, fontSize: 13, fontWeight: "500", marginTop: 8 },
    uploadOverlay: { ...StyleSheet.absoluteFill, backgroundColor: c.overlay, justifyContent: "center", alignItems: "center" },
    uploadOverlayText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600", marginTop: 8 },
    form: { width: "100%" },
    row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
    col: { flex: 1 },
    fieldLabel: { fontSize: 13, color: c.textSub, fontWeight: "500", marginTop: 12, marginBottom: 8 },
    selectorContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
    selectorChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    selectorChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    selectorText: { fontSize: 13, color: c.textSub, fontWeight: "500" },
    selectorTextActive: { color: "#FFFFFF", fontWeight: "600" },
    switchRow: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      backgroundColor: c.surface2, borderRadius: 8, borderWidth: 1, borderColor: c.border,
      padding: 14, marginVertical: 12,
    },
    switchLabel: { fontSize: 14, color: c.text, fontWeight: "600" },
    switchDesc: { fontSize: 12, color: c.textMuted, marginTop: 2, maxWidth: "85%" },
    periodicitySection: { marginVertical: 8 },
    notesInput: { paddingTop: 12 },
    submitBtn: { marginTop: 24 },
  });
}
