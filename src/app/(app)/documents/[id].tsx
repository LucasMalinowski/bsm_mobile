import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Linking, RefreshControl, Switch,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
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

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      router.replace("/(app)/(tabs)/documents");
    },
    onError: (err: any) => Alert.alert("Erro", err.message || "Não foi possível excluir o documento."),
  });

  const handleDownload = async () => {
    try {
      const res = await documentsApi.getDownloadUrl(id);
      const downloadUrl = typeof res === "string" ? res : (res as any)?.url ?? (res as any)?.signed_url;

      if (!downloadUrl) {
        Alert.alert("Erro", "URL de download não disponível.");
        return;
      }

      const canOpen = await Linking.canOpenURL(downloadUrl);
      if (canOpen) {
        await Linking.openURL(downloadUrl);
      } else {
        const fileName = doc?.name ?? `document_${id}`;
        const localUri = `${(FileSystem as any).cacheDirectory}${fileName}`;
        const downloadRes = await FileSystem.downloadAsync(downloadUrl, localUri);
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(downloadRes.uri);
        } else {
          Alert.alert("Baixado", `Arquivo salvo em: ${downloadRes.uri}`);
        }
      }
    } catch (err: any) {
      Alert.alert("Erro de Download", err.message || "Não foi possível baixar o arquivo.");
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Excluir Documento",
      "Tem certeza que deseja excluir este documento? Esta ação não pode ser desfeita.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Excluir", style: "destructive", onPress: () => deleteMutation.mutate() },
      ]
    );
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

  if (isLoading) {
    return <View style={s.center}><ActivityIndicator size="large" color="#6366F1" /></View>;
  }

  if (isError || !data?.data) {
    return (
      <View style={s.center}>
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text style={s.errorText}>Erro ao carregar documento.</Text>
        <TouchableOpacity onPress={() => refetch()} style={s.retryBtn}>
          <Text style={s.retryBtnText}>Tentar Novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const doc = data.data;
  const versions = doc.versions ?? [];

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backAction}>
          <Ionicons name="arrow-back" size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>Documento</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#6366F1" />}
      >
        {/* Main info card */}
        <Card style={s.mainCard}>
          <View style={s.iconRow}>
            <View style={s.docIconBox}>
              <Ionicons name="document-text" size={36} color="#6366F1" />
            </View>
            <View style={s.titleMeta}>
              <Text style={s.docName}>{doc.name}</Text>
              {doc.description && <Text style={s.docDesc}>{doc.description}</Text>}
            </View>
          </View>

          <View style={s.divider} />

          <View style={s.infoGrid}>
            <Row label="Tamanho" value={formatBytes(doc.file_size)} />
            <Row label="Tipo" value={doc.mime_type} />
            <Row label="Versão" value={`v${doc.version}`} />
            <Row label="Enviado por" value={doc.uploader?.name ?? "N/D"} />
            {doc.category && <Row label="Categoria" value={doc.category.name} />}
            {doc.equipment && <Row label="Equipamento" value={`${doc.equipment.name} (${doc.equipment.internal_code})`} />}
            {can(user, "document:update") ? (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Visível p/ Funcionários</Text>
                <Switch
                  value={doc.visible_to_employees}
                  onValueChange={(v) => visibilityMutation.mutate(v)}
                  disabled={visibilityMutation.isPending}
                  trackColor={{ false: "#2E3033", true: "#6366F1" }}
                  thumbColor="#FFFFFF"
                />
              </View>
            ) : (
              <Row label="Visível p/ Funcionários" value={doc.visible_to_employees ? "Sim" : "Não"} />
            )}
            <Row label="Atualizado em" value={new Date(doc.updated_at).toLocaleDateString("pt-BR")} />
          </View>
        </Card>

        {/* Actions */}
        <TouchableOpacity style={s.downloadBtn} onPress={handleDownload}>
          <Ionicons name="cloud-download-outline" size={20} color="#FFFFFF" />
          <Text style={s.downloadBtnText}>Baixar / Abrir Documento</Text>
        </TouchableOpacity>

        {can(user, "document:upload") && (
          <Button
            title={uploadingVersion ? "Enviando..." : "Nova Versão"}
            variant="outline"
            onPress={handleUploadVersion}
            loading={uploadingVersion}
            style={s.versionBtn}
          />
        )}

        {can(user, "document:delete") && (
          <Button
            title="Excluir Documento"
            variant="danger"
            onPress={handleDelete}
            loading={deleteMutation.isPending}
            style={s.deleteBtn}
          />
        )}

        {/* Version history */}
        {versions.length > 0 && (
          <Card style={s.versionCard}>
            <Text style={s.sectionTitle}>Histórico de Versões</Text>
            {versions.map((v) => (
              <View key={v.id} style={s.versionRow}>
                <View style={s.versionBadge}>
                  <Text style={s.versionNum}>v{v.version}</Text>
                </View>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F0F10" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F0F10", padding: 24 },
  errorText: { color: "#EF4444", fontSize: 15, marginTop: 12, textAlign: "center", marginBottom: 16 },
  retryBtn: { backgroundColor: "#6366F1", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  retryBtnText: { color: "#FFFFFF", fontWeight: "600" },
  header: { height: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#111214", borderBottomWidth: 1, borderBottomColor: "#2E3033", paddingHorizontal: 16, paddingTop: 12 },
  backAction: { padding: 4 },
  headerTitle: { color: "#F8FAFC", fontSize: 16, fontWeight: "700", maxWidth: "80%" },
  scroll: { padding: 16, paddingBottom: 40 },
  mainCard: { backgroundColor: "#151618", marginBottom: 16 },
  iconRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 16 },
  docIconBox: { width: 56, height: 56, backgroundColor: "#1A1A2E", borderRadius: 12, justifyContent: "center", alignItems: "center", marginRight: 16 },
  titleMeta: { flex: 1 },
  docName: { fontSize: 16, fontWeight: "700", color: "#F8FAFC", marginBottom: 4 },
  docDesc: { fontSize: 13, color: "#64748B", lineHeight: 18 },
  divider: { height: 1, backgroundColor: "#212225", marginBottom: 16 },
  infoGrid: { gap: 2 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#212225" },
  infoLabel: { color: "#64748B", fontSize: 13 },
  infoValue: { color: "#E2E8F0", fontSize: 13, fontWeight: "600", maxWidth: "55%", textAlign: "right" },
  downloadBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#6366F1", borderRadius: 10, padding: 16, marginBottom: 12 },
  downloadBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  versionBtn: { marginBottom: 12 },
  deleteBtn: { marginBottom: 20 },
  versionCard: { backgroundColor: "#151618" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#F8FAFC", marginBottom: 16 },
  versionRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#212225" },
  versionBadge: { backgroundColor: "#1A1A2E", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginRight: 12 },
  versionNum: { color: "#818CF8", fontSize: 12, fontWeight: "700" },
  versionMeta: { flex: 1 },
  versionUploader: { color: "#E2E8F0", fontSize: 13, fontWeight: "600" },
  versionDate: { color: "#64748B", fontSize: 11 },
  versionNotes: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  versionSize: { color: "#475569", fontSize: 11 },
});
