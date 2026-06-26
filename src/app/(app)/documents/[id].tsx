import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Linking, RefreshControl, Switch,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { documentsApi } from "../../../api/documents";
import { useAuth } from "../../../auth/AuthProvider";
import { can } from "../../../auth/permissions";
import { useTheme } from "../../../contexts/ThemeContext";
import type { Colors } from "../../../constants/colors";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { colors: c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const queryClient = useQueryClient();
  const [uploadingVersion, setUploadingVersion] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["document", id],
    queryFn: () => documentsApi.get(id),
  });

  const visibilityMutation = useMutation({
    mutationFn: (visible: boolean) => documentsApi.update(id, { visible_to_employees: visible }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["document", id] }),
    onError: (err: any) => Alert.alert("Erro", err.message || "Não foi possível alterar a visibilidade."),
  });

  const deleteMutation = useMutation({
    mutationFn: () => documentsApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["documents"] }); router.replace("/(app)/(tabs)/documents"); },
    onError: (err: any) => Alert.alert("Erro", err.message || "Não foi possível excluir o documento."),
  });

  const handleDownload = async () => {
    try {
      const res = await documentsApi.getDownloadUrl(id);
      const downloadUrl = typeof res === "string" ? res : (res as any)?.url ?? (res as any)?.signed_url;
      if (!downloadUrl) { Alert.alert("Erro", "URL de download não disponível."); return; }
      const canOpen = await Linking.canOpenURL(downloadUrl);
      if (canOpen) {
        await Linking.openURL(downloadUrl);
      } else {
        const fileName = doc?.name ?? `document_${id}`;
        const localUri = `${(FileSystem as any).cacheDirectory}${fileName}`;
        const downloadRes = await FileSystem.downloadAsync(downloadUrl, localUri);
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) { await Sharing.shareAsync(downloadRes.uri); }
        else { Alert.alert("Baixado", `Arquivo salvo em: ${downloadRes.uri}`); }
      }
    } catch (err: any) {
      Alert.alert("Erro de Download", err.message || "Não foi possível baixar o arquivo.");
    }
  };

  const handleDelete = () => {
    Alert.alert("Excluir Documento", "Tem certeza que deseja excluir este documento? Esta ação não pode ser desfeita.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: () => deleteMutation.mutate() },
    ]);
  };

  const handleUploadVersion = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) return;
      const file = result.assets[0];
      setUploadingVersion(true);
      await documentsApi.uploadVersion(id, file.uri, file.name, file.mimeType ?? "application/octet-stream");
      queryClient.invalidateQueries({ queryKey: ["document", id] });
      Alert.alert("Sucesso", "Nova versão enviada com sucesso!");
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Não foi possível enviar a nova versão.");
    } finally {
      setUploadingVersion(false);
    }
  };

  if (isLoading) return <View style={s.center}><ActivityIndicator size="large" color={c.primary} /></View>;

  if (isError || !data?.data) {
    return (
      <View style={s.center}>
        <Ionicons name="alert-circle-outline" size={48} color={c.error} />
        <Text style={s.errorText}>Erro ao carregar documento.</Text>
        <TouchableOpacity onPress={() => refetch()} style={s.retryBtn}><Text style={s.retryBtnText}>Tentar Novamente</Text></TouchableOpacity>
      </View>
    );
  }

  const doc = data.data;
  const versions = doc.versions ?? [];

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: 12 + insets.top, minHeight: 64 + insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backAction}>
          <Ionicons name="arrow-back" size={24} color={c.headerText} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>Documento</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={c.primary} />}>
        <Card style={s.mainCard}>
          <View style={s.iconRow}>
            <View style={s.docIconBox}><Ionicons name="document-text" size={36} color={c.primary} /></View>
            <View style={s.titleMeta}>
              <Text style={s.docName}>{doc.name}</Text>
              {doc.description && <Text style={s.docDesc}>{doc.description}</Text>}
            </View>
          </View>
          <View style={s.divider} />
          <View style={s.infoGrid}>
            <DocRow label="Tamanho" value={formatBytes(doc.file_size)} c={c} />
            <DocRow label="Tipo" value={doc.mime_type} c={c} />
            <DocRow label="Versão" value={`v${doc.version}`} c={c} />
            <DocRow label="Enviado por" value={doc.uploader?.name ?? "N/D"} c={c} />
            {doc.category && <DocRow label="Categoria" value={doc.category.name} c={c} />}
            {doc.equipment && <DocRow label="Equipamento" value={`${doc.equipment.name} (${doc.equipment.internal_code})`} c={c} />}
            {can(user, "document:update") ? (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Visível p/ Funcionários</Text>
                <Switch value={doc.visible_to_employees} onValueChange={(v) => visibilityMutation.mutate(v)} disabled={visibilityMutation.isPending} trackColor={{ false: c.border, true: c.primary }} thumbColor="#FFFFFF" />
              </View>
            ) : <DocRow label="Visível p/ Funcionários" value={doc.visible_to_employees ? "Sim" : "Não"} c={c} />}
            <DocRow label="Atualizado em" value={new Date(doc.updated_at).toLocaleDateString("pt-BR")} c={c} />
          </View>
        </Card>

        <TouchableOpacity style={s.downloadBtn} onPress={handleDownload}>
          <Ionicons name="cloud-download-outline" size={20} color="#FFFFFF" />
          <Text style={s.downloadBtnText}>Baixar / Abrir Documento</Text>
        </TouchableOpacity>

        {user?.role === "super_admin" && <Button title={uploadingVersion ? "Enviando..." : "Nova Versão"} variant="outline" onPress={handleUploadVersion} loading={uploadingVersion} style={s.versionBtn} />}
        {user?.role === "super_admin" && <Button title="Excluir Documento" variant="danger" onPress={handleDelete} loading={deleteMutation.isPending} style={s.deleteBtn} />}

        {versions.length > 0 && (
          <Card style={s.versionCard}>
            <Text style={s.sectionTitle}>Histórico de Versões</Text>
            {versions.map((v) => (
              <View key={v.id} style={s.versionRow}>
                <View style={s.versionBadge}><Text style={s.versionNum}>v{v.version}</Text></View>
                <View style={s.versionMeta}>
                  <Text style={s.versionUploader}>{v.uploader?.name ?? "Desconhecido"}</Text>
                  <Text style={s.versionDate}>{new Date(v.created_at).toLocaleDateString("pt-BR")}</Text>
                  {v.notes && <Text style={s.versionNotes}>{v.notes}</Text>}
                </View>
                <Text style={s.versionSize}>{formatBytes(v.file_size)}</Text>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

function DocRow({ label, value, c }: { label: string; value: string; c: Colors }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.divider }}>
      <Text style={{ color: c.textMuted, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: c.text, fontSize: 13, fontWeight: "600", maxWidth: "55%", textAlign: "right" }} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: c.bg, padding: 24 },
    errorText: { color: c.error, fontSize: 15, marginTop: 12, textAlign: "center", marginBottom: 16 },
    retryBtn: { backgroundColor: c.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
    retryBtnText: { color: "#FFFFFF", fontWeight: "600" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: c.header, borderBottomWidth: 1, borderBottomColor: c.border, paddingHorizontal: 16, paddingBottom: 12 },
    backAction: { padding: 4 },
    headerTitle: { color: c.headerText, fontSize: 16, fontWeight: "700", maxWidth: "80%" },
    scroll: { padding: 16, paddingBottom: 40 },
    mainCard: { marginBottom: 16 },
    iconRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 16 },
    docIconBox: { width: 56, height: 56, backgroundColor: c.primaryLight, borderRadius: 12, justifyContent: "center", alignItems: "center", marginRight: 16 },
    titleMeta: { flex: 1 },
    docName: { fontSize: 16, fontWeight: "700", color: c.text, marginBottom: 4 },
    docDesc: { fontSize: 13, color: c.textMuted, lineHeight: 18 },
    divider: { height: 1, backgroundColor: c.divider, marginBottom: 16 },
    infoGrid: { gap: 2 },
    infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.divider },
    infoLabel: { color: c.textMuted, fontSize: 13 },
    downloadBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: c.primary, borderRadius: 10, padding: 16, marginBottom: 12 },
    downloadBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
    versionBtn: { marginBottom: 12 },
    deleteBtn: { marginBottom: 20 },
    versionCard: {},
    sectionTitle: { fontSize: 15, fontWeight: "700", color: c.text, marginBottom: 16 },
    versionRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.divider },
    versionBadge: { backgroundColor: c.primaryLight, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginRight: 12 },
    versionNum: { color: c.primary, fontSize: 12, fontWeight: "700" },
    versionMeta: { flex: 1 },
    versionUploader: { color: c.text, fontSize: 13, fontWeight: "600" },
    versionDate: { color: c.textMuted, fontSize: 11 },
    versionNotes: { color: c.textSub, fontSize: 12, marginTop: 2 },
    versionSize: { color: c.textMuted, fontSize: 11 },
  });
}
