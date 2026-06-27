import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Switch, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, TextInput as RNTextInput } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { equipmentApi } from "../../../api/equipment";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../../../auth/AuthProvider";
import { useTheme } from "../../../contexts/ThemeContext";
import type { Colors } from "../../../constants/colors";

const CATEGORIES = ["Pesagem", "Óptica", "Química", "Esterilização", "Separação", "Temperatura", "Microbiologia"];

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

type CalibrationPoint = { point_value: string; criterion: string; error_tolerance: string };

function maskDate(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function displayToISO(display: string): string {
  const parts = display.split("/");
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  }
  return "";
}

function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return iso;
}

const schema = z.object({
  internal_code: z.string().min(1, "Código interno é obrigatório"),
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  category_name: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  serial_number: z.string().optional(),
  location: z.string().optional(),
  acquisition_date: z.string().optional(),
  acquisition_cost: z.string().optional(),
  status: z.enum(["active", "inactive", "under_maintenance", "calibration", "retired"]),
  requires_calibration: z.boolean().default(true),
  calibration_periodicity: z.enum(["semestral", "anual", "bi_anual", "tri_anual", "outro"]).nullable().optional(),
  notes: z.string().optional(),
  image_url: z.string().nullable().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function NewEquipmentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user, activeCompanyId } = useAuth();
  const { colors: c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);

  const [step, setStep] = useState(1);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [dateDisplay, setDateDisplay] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [calPoints, setCalPoints] = useState<CalibrationPoint[]>([]);
  const [savingPoints, setSavingPoints] = useState(false);

  const { control, handleSubmit, setValue, watch, formState: { errors }, trigger } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      internal_code: "", name: "", brand: "", model: "", serial_number: "",
      location: "", acquisition_date: "", status: "active",
      requires_calibration: true, calibration_periodicity: "anual", notes: "", image_url: null,
    },
  });

  const requiresCalibration = watch("requires_calibration");

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const isoDate = displayToISO(dateDisplay);
      const result = await equipmentApi.create({
        ...data,
        category_name: selectedCategory || undefined,
        acquisition_date: isoDate || null,
        acquisition_cost: data.acquisition_cost ? Number(data.acquisition_cost) : null,
        calibration_periodicity: data.requires_calibration ? data.calibration_periodicity : null,
        company_id: user?.role === "super_admin" ? activeCompanyId ?? undefined : undefined,
      } as any);
      return result;
    },
    onSuccess: async (result: any) => {
      const equipmentId = result?.data?.id;
      if (equipmentId && requiresCalibration && calPoints.filter((p) => p.point_value.trim()).length > 0) {
        setSavingPoints(true);
        try {
          await equipmentApi.saveCalibrationPoints(equipmentId, calPoints
            .filter((p) => p.point_value.trim())
            .map((p, i) => ({
              point_value: p.point_value,
              criterion: p.criterion,
              error_tolerance: p.error_tolerance.trim() ? Number(p.error_tolerance) : null,
              sort_order: i,
            })));
        } catch { /* non-fatal */ }
        setSavingPoints(false);
      }
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      Alert.alert("Sucesso", "Equipamento registrado com sucesso!");
      router.back();
    },
    onError: (err: any) => Alert.alert("Erro", err.message || "Erro ao criar equipamento."),
  });

  const selectPhoto = async () => {
    Alert.alert("Adicionar foto", "", [
      {
        text: "Câmera",
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) { Alert.alert("Permissão negada", "Ative o acesso à câmera nas configurações."); return; }
          const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
          await handlePhotoResult(result);
        },
      },
      {
        text: "Galeria",
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) { Alert.alert("Permissão negada", "Ative o acesso à galeria nas configurações."); return; }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8 });
          await handlePhotoResult(result);
        },
      },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const handlePhotoResult = async (result: ImagePicker.ImagePickerResult) => {
    if (!result.canceled && result.assets?.length > 0) {
      const selected = result.assets[0];
      setPhotoUri(selected.uri);
      setUploadingPhoto(true);
      try {
        const filename = selected.fileName || `eq_${Date.now()}.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const mimeType = match ? `image/${match[1]}` : "image/jpeg";
        const uploadRes = await equipmentApi.uploadPhoto(selected.uri, filename, mimeType);
        setValue("image_url", uploadRes.url);
      } catch (err: any) {
        Alert.alert("Erro", err.message || "Não foi possível enviar a foto.");
        setPhotoUri(null);
      } finally {
        setUploadingPhoto(false);
      }
    }
  };

  const goToStep2 = async () => {
    const valid = await trigger(["name", "internal_code"]);
    if (valid) setStep(2);
  };

  const addPoint = () => setCalPoints((p) => [...p, { point_value: "", criterion: "", error_tolerance: "" }]);
  const removePoint = (i: number) => setCalPoints((p) => p.filter((_, idx) => idx !== i));
  const updatePoint = (i: number, field: keyof CalibrationPoint, value: string) =>
    setCalPoints((p) => p.map((pt, idx) => idx === i ? { ...pt, [field]: value } : pt));

  const onSubmit = (data: FormValues) => createMutation.mutate(data);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.container}>
      <View style={[s.header, { paddingTop: 12 + insets.top, minHeight: 64 + insets.top }]}>
        <TouchableOpacity onPress={() => step === 1 ? router.back() : setStep(1)} style={s.backAction}>
          <Ionicons name="arrow-back" size={24} color={c.headerText} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{step === 1 ? "Novo Equipamento" : "Calibração"}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Step indicator */}
      <View style={s.stepBar}>
        <View style={[s.stepDot, step >= 1 ? s.stepDotActive : null]} />
        <View style={s.stepLine} />
        <View style={[s.stepDot, step >= 2 ? s.stepDotActive : null]} />
      </View>

      <ScrollView contentContainerStyle={s.scrollContainer} keyboardShouldPersistTaps="handled">
        {step === 1 ? (
          <>
            {/* Photo */}
            <TouchableOpacity onPress={selectPhoto} style={s.photoContainer}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={s.selectedPhoto} />
              ) : (
                <View style={s.photoPlaceholder}>
                  <Ionicons name="camera-outline" size={32} color={c.textMuted} />
                  <Text style={s.photoText}>Adicionar Foto do Equipamento</Text>
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

              {/* Category chips */}
              <Text style={s.fieldLabel}>Categoria</Text>
              <View style={s.selectorContainer}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => { setSelectedCategory(cat === selectedCategory ? null : cat); setValue("category_name", cat === selectedCategory ? undefined : cat); }}
                    style={[s.selectorChip, selectedCategory === cat ? s.selectorChipActive : null]}
                  >
                    <Text style={[s.selectorText, selectedCategory === cat ? s.selectorTextActive : null]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={s.row}>
                <View style={s.col}>
                  <Controller control={control} name="brand" render={({ field: { onChange, onBlur, value } }) => (
                    <Input label="Marca" placeholder="Mettler" onBlur={onBlur} onChangeText={onChange} value={value} />
                  )} />
                </View>
                <View style={s.col}>
                  <Controller control={control} name="model" render={({ field: { onChange, onBlur, value } }) => (
                    <Input label="Modelo" placeholder="XP204" onBlur={onBlur} onChangeText={onChange} value={value} />
                  )} />
                </View>
              </View>

              <Controller control={control} name="serial_number" render={({ field: { onChange, onBlur, value } }) => (
                <Input label="Número de Série" placeholder="Ex: SN987654" onBlur={onBlur} onChangeText={onChange} value={value} />
              )} />
              <Controller control={control} name="location" render={({ field: { onChange, onBlur, value } }) => (
                <Input label="Localização / Setor" placeholder="Ex: Laboratório de P&D" onBlur={onBlur} onChangeText={onChange} value={value} />
              )} />

              {/* Acquisition date with mask */}
              <Text style={s.fieldLabel}>Data de Aquisição</Text>
              <RNTextInput
                style={s.maskedInput}
                placeholder="DD/MM/AAAA"
                placeholderTextColor={c.textMuted}
                keyboardType="numeric"
                value={dateDisplay}
                onChangeText={(text) => setDateDisplay(maskDate(text))}
                maxLength={10}
              />

              <Controller control={control} name="acquisition_cost" render={({ field: { onChange, onBlur, value } }) => (
                <Input label="Custo de Aquisição (R$)" placeholder="Ex: 15000.00" onBlur={onBlur} onChangeText={onChange} value={value ?? ""} keyboardType="decimal-pad" />
              )} />

              <Text style={s.fieldLabel}>Status Operacional</Text>
              <Controller control={control} name="status" render={({ field: { onChange, value } }) => (
                <View style={s.selectorContainer}>
                  {STATUSES.map((st) => (
                    <TouchableOpacity key={st.value} onPress={() => onChange(st.value)} style={[s.selectorChip, value === st.value ? s.selectorChipActive : null]}>
                      <Text style={[s.selectorText, value === st.value ? s.selectorTextActive : null]}>{st.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )} />

              <Controller control={control} name="notes" render={({ field: { onChange, onBlur, value } }) => (
                <Input label="Observações" placeholder="Notas adicionais..." onBlur={onBlur} onChangeText={onChange} value={value} multiline numberOfLines={4} style={{ height: 100, textAlignVertical: "top" }} />
              )} />

              <Button title="Próximo: Calibração" onPress={goToStep2} style={s.submitBtn} />
            </View>
          </>
        ) : (
          <View style={s.form}>
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
              <>
                <Text style={s.fieldLabel}>Periodicidade de Calibração</Text>
                <Controller control={control} name="calibration_periodicity" render={({ field: { onChange, value } }) => (
                  <View style={s.selectorContainer}>
                    {PERIODICITIES.map((p) => (
                      <TouchableOpacity key={p.value} onPress={() => onChange(p.value)} style={[s.selectorChip, value === p.value ? s.selectorChipActive : null]}>
                        <Text style={[s.selectorText, value === p.value ? s.selectorTextActive : null]}>{p.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )} />

                <View style={s.pointsHeader}>
                  <Text style={s.fieldLabel}>Pontos de Calibração</Text>
                  <TouchableOpacity onPress={addPoint} style={s.addPointBtn}>
                    <Ionicons name="add" size={16} color={c.primary} />
                    <Text style={[s.addPointText, { color: c.primary }]}>Adicionar</Text>
                  </TouchableOpacity>
                </View>

                {calPoints.length === 0 ? (
                  <Text style={s.emptyPoints}>Nenhum ponto adicionado. Toque em "Adicionar" acima.</Text>
                ) : calPoints.map((pt, i) => (
                  <View key={i} style={s.pointRow}>
                    <View style={s.pointFields}>
                      <RNTextInput
                        style={s.pointInput}
                        placeholder="Ponto (ex: 100g)"
                        placeholderTextColor={c.textMuted}
                        value={pt.point_value}
                        onChangeText={(v) => updatePoint(i, "point_value", v)}
                      />
                      <RNTextInput
                        style={[s.pointInput, s.pointInputSmall]}
                        placeholder="Erro (±)"
                        placeholderTextColor={c.textMuted}
                        value={pt.error_tolerance}
                        onChangeText={(v) => updatePoint(i, "error_tolerance", v)}
                        keyboardType="decimal-pad"
                      />
                      <RNTextInput
                        style={s.pointInput}
                        placeholder="Critério"
                        placeholderTextColor={c.textMuted}
                        value={pt.criterion}
                        onChangeText={(v) => updatePoint(i, "criterion", v)}
                      />
                    </View>
                    <TouchableOpacity onPress={() => removePoint(i)} style={s.removePointBtn}>
                      <Ionicons name="close" size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}

            <Button
              title={createMutation.isPending || savingPoints ? "Salvando..." : "Salvar Equipamento"}
              onPress={handleSubmit(onSubmit as any)}
              loading={createMutation.isPending || savingPoints}
              style={s.submitBtn}
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      backgroundColor: c.header, borderBottomWidth: 1, borderBottomColor: c.border,
      paddingHorizontal: 16, paddingBottom: 12,
    },
    backAction: { padding: 4 },
    headerTitle: { color: c.headerText, fontSize: 16, fontWeight: "700" },
    stepBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 40, paddingVertical: 12, backgroundColor: c.header },
    stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.border },
    stepDotActive: { backgroundColor: c.primary },
    stepLine: { flex: 1, height: 2, backgroundColor: c.border, marginHorizontal: 8 },
    scrollContainer: { padding: 16, paddingBottom: 40 },
    photoContainer: {
      height: 160, backgroundColor: c.surface2, borderRadius: 12, borderWidth: 1,
      borderColor: c.border, borderStyle: "dashed", justifyContent: "center",
      alignItems: "center", overflow: "hidden", marginBottom: 20,
    },
    selectedPhoto: { width: "100%", height: "100%" },
    photoPlaceholder: { justifyContent: "center", alignItems: "center" },
    photoText: { color: c.textMuted, fontSize: 13, fontWeight: "500", marginTop: 8 },
    uploadOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
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
    maskedInput: {
      height: 44, borderWidth: 1, borderColor: c.border, borderRadius: 8,
      paddingHorizontal: 12, color: c.text, fontSize: 14, backgroundColor: c.surface,
      marginBottom: 16,
    },
    switchRow: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      backgroundColor: c.surface2, borderRadius: 8, borderWidth: 1, borderColor: c.border,
      padding: 14, marginVertical: 12,
    },
    switchLabel: { fontSize: 14, color: c.text, fontWeight: "600" },
    switchDesc: { fontSize: 12, color: c.textMuted, marginTop: 2, maxWidth: "85%" },
    pointsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4, marginBottom: 8 },
    addPointBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
    addPointText: { fontSize: 13, fontWeight: "600" },
    emptyPoints: { fontSize: 12, color: c.textMuted, textAlign: "center", paddingVertical: 12, fontStyle: "italic" },
    pointRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
    pointFields: { flex: 1, flexDirection: "row", gap: 6 },
    pointInput: {
      flex: 1, height: 38, borderWidth: 1, borderColor: c.border, borderRadius: 8,
      paddingHorizontal: 8, color: c.text, fontSize: 12, backgroundColor: c.surface,
    },
    pointInputSmall: { flex: 0.6 },
    removePointBtn: { padding: 4 },
    submitBtn: { marginTop: 24 },
  });
}
