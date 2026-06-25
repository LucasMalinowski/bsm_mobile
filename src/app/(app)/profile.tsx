import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Alert, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../../auth/AuthProvider";
import { can, isAdmin } from "../../auth/permissions";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { usersApi } from "../../api/users";
import { companyApi } from "../../api/company";

export default function ProfileScreen() {
  const { user, logout, updateUser, activeCompanyId } = useAuth();
  const router = useRouter();

  const { data: activeCompanyData } = useQuery({
    queryKey: ["companies", activeCompanyId],
    queryFn: () => companyApi.get(activeCompanyId!),
    enabled: !!activeCompanyId && user?.role === "super_admin",
  });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "employee">("employee");

  const inviteMutation = useMutation({
    mutationFn: () => usersApi.invite(
      inviteEmail.trim(),
      inviteName.trim(),
      inviteRole,
      (user?.role === "super_admin" ? activeCompanyId : user?.company_id) ?? undefined
    ),
    onSuccess: () => {
      Alert.alert("Convite Enviado", `O convite foi enviado para ${inviteEmail}.`);
      setInviteModalVisible(false);
      setInviteName("");
      setInviteEmail("");
      setInviteRole("employee");
    },
    onError: (err: any) => Alert.alert("Erro", err.message || "Não foi possível enviar o convite."),
  });

  const handleSelectAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permissão negada", "Necessitamos de acesso à galeria.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      const sel = result.assets[0];
      setUploadingAvatar(true);
      try {
        const name = sel.fileName || `avatar_${Date.now()}.jpg`;
        const ext = /\.(\w+)$/.exec(name)?.[1] ?? "jpg";
        const res = await usersApi.uploadAvatar(sel.uri, name, `image/${ext}`);
        if (user) {
          const updated = { ...user, avatar_url: res.url };
          await updateUser(updated);
          Alert.alert("Sucesso", "Foto de perfil atualizada!");
        }
      } catch (e: any) {
        Alert.alert("Erro", e.message || "Falha ao enviar avatar.");
      } finally {
        setUploadingAvatar(false);
      }
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Sair da Conta",
      "Deseja realmente sair do BSM System?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Sair", style: "destructive", onPress: async () => { await logout(); } },
      ]
    );
  };

  if (!user) return null;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backAction}>
          <Ionicons name="arrow-back" size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Perfil e Configurações</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {/* Avatar Card */}
        <Card style={s.avatarCard}>
          <TouchableOpacity onPress={handleSelectAvatar} style={s.avatarContainer}>
            {uploadingAvatar ? (
              <View style={s.avatarPlaceholder}>
                <ActivityIndicator size="small" color="#6366F1" />
              </View>
            ) : user.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={s.avatar} />
            ) : (
              <View style={s.avatarPlaceholder}>
                <Text style={s.avatarInitials}>{user.name.slice(0, 2).toUpperCase()}</Text>
              </View>
            )}
            <View style={s.cameraOverlay}>
              <Ionicons name="camera" size={14} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <Text style={s.userName}>{user.name}</Text>
          <Text style={s.userEmail}>{user.email}</Text>
          <Badge type={user.role} style={s.roleBadge} />
        </Card>

        {/* Info Section */}
        <Card style={s.infoCard}>
          <Text style={s.sectionTitle}>Informações da Conta</Text>
          <InfoRow icon="person-outline" label="Nome Completo" value={user.name} />
          <InfoRow icon="mail-outline" label="E-mail" value={user.email} />
          <InfoRow icon="shield-checkmark-outline" label="Função" value={user.role === "super_admin" ? "Super Administrador" : user.role === "admin" ? "Administrador" : "Funcionário"} />
          {user.company_id && (
            <InfoRow icon="business-outline" label="ID da Empresa" value={user.company_id.slice(0, 8) + "..."} />
          )}
        </Card>

        {/* Permissions summary */}
        <Card style={s.infoCard}>
          <Text style={s.sectionTitle}>Permissões Ativas ({user.permissions.length})</Text>
          <View style={s.permissionsWrap}>
            {user.role === "super_admin" ? (
              <View style={s.superAdminBadge}>
                <Ionicons name="infinite-outline" size={14} color="#D8B4FE" />
                <Text style={s.superAdminText}>Acesso Completo ao Sistema</Text>
              </View>
            ) : (
              user.permissions.map((p) => (
                <View key={p} style={s.permChip}>
                  <Text style={s.permChipText}>{p}</Text>
                </View>
              ))
            )}
          </View>
        </Card>

        {/* Admin section */}
        {isAdmin(user) && (
          <Card style={s.adminCard}>
            <Text style={s.sectionTitle}>Administração</Text>
            {user.role === "super_admin" && (
              <TouchableOpacity style={s.adminLink} onPress={() => router.push("/(app)/select-company" as any)}>
                <Ionicons name="business-outline" size={18} color="#94A3B8" />
                <Text style={s.adminLinkText}>
                  {activeCompanyData?.data?.name ?? "Selecionar Empresa"}
                </Text>
                <Ionicons name="chevron-forward" size={14} color="#475569" />
              </TouchableOpacity>
            )}
            {can(user, "user:read") && (
              <TouchableOpacity style={s.adminLink} onPress={() => router.push("/(app)/users/" as any)}>
                <Ionicons name="people-outline" size={18} color="#94A3B8" />
                <Text style={s.adminLinkText}>Gerenciar Usuários</Text>
                <Ionicons name="chevron-forward" size={14} color="#475569" />
              </TouchableOpacity>
            )}
            {can(user, "user:invite") && (
              <TouchableOpacity style={s.adminLink} onPress={() => setInviteModalVisible(true)}>
                <Ionicons name="mail-outline" size={18} color="#94A3B8" />
                <Text style={s.adminLinkText}>Convidar Usuário</Text>
                <Ionicons name="chevron-forward" size={14} color="#475569" />
              </TouchableOpacity>
            )}
          </Card>
        )}

        {/* Settings */}
        <Card style={s.adminCard}>
          <Text style={s.sectionTitle}>Configurações</Text>
          <TouchableOpacity style={s.adminLink} onPress={() => router.push("/(app)/notification-preferences" as any)}>
            <Ionicons name="notifications-outline" size={18} color="#94A3B8" />
            <Text style={s.adminLinkText}>Notificações</Text>
            <Ionicons name="chevron-forward" size={14} color="#475569" />
          </TouchableOpacity>
          {can(user, "company:settings") && (
            <TouchableOpacity style={[s.adminLink, { borderBottomWidth: 0 }]} onPress={() => router.push("/(app)/company-settings" as any)}>
              <Ionicons name="business-outline" size={18} color="#94A3B8" />
              <Text style={s.adminLinkText}>Empresa</Text>
              <Ionicons name="chevron-forward" size={14} color="#475569" />
            </TouchableOpacity>
          )}
        </Card>

        {/* App Version */}
        <View style={s.versionRow}>
          <Text style={s.versionText}>BSM Mobile · v1.0.0</Text>
        </View>

        {/* Sign out */}
        <Button
          title="Sair da Conta"
          variant="danger"
          onPress={handleLogout}
          style={s.logoutBtn}
        />
      </ScrollView>

      {/* Invite Modal */}
      <Modal visible={inviteModalVisible} animationType="slide" transparent onRequestClose={() => setInviteModalVisible(false)}>
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Convidar Usuário</Text>
              <TouchableOpacity onPress={() => setInviteModalVisible(false)}>
                <Ionicons name="close" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <View style={s.modalBody}>
              <Text style={s.inputLabel}>Nome Completo *</Text>
              <TextInput
                value={inviteName}
                onChangeText={setInviteName}
                placeholder="Nome do usuário"
                placeholderTextColor="#5E636E"
                style={s.modalInput}
                autoCapitalize="words"
              />

              <Text style={s.inputLabel}>E-mail *</Text>
              <TextInput
                value={inviteEmail}
                onChangeText={setInviteEmail}
                placeholder="email@empresa.com"
                placeholderTextColor="#5E636E"
                style={s.modalInput}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={s.inputLabel}>Função</Text>
              <View style={s.roleChips}>
                {([
                  { value: "employee", label: "Funcionário" },
                  { value: "admin", label: "Administrador" },
                ] as const).map((r) => (
                  <TouchableOpacity
                    key={r.value}
                    onPress={() => setInviteRole(r.value)}
                    style={[s.roleChip, inviteRole === r.value && s.roleChipActive]}
                  >
                    <Text style={[s.roleChipText, inviteRole === r.value && s.roleChipTextActive]}>{r.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Button
                title="Enviar Convite"
                onPress={() => {
                  if (!inviteName.trim() || !inviteEmail.trim()) {
                    Alert.alert("Atenção", "Nome e e-mail são obrigatórios.");
                    return;
                  }
                  inviteMutation.mutate();
                }}
                loading={inviteMutation.isPending}
                style={s.modalSaveBtn}
              />
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <Ionicons name={icon as any} size={16} color="#64748B" />
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F0F10" },
  header: { height: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#111214", borderBottomWidth: 1, borderBottomColor: "#2E3033", paddingHorizontal: 16, paddingTop: 12 },
  backAction: { padding: 4 },
  headerTitle: { color: "#F8FAFC", fontSize: 16, fontWeight: "700" },
  scroll: { padding: 16, paddingBottom: 48 },
  avatarCard: { backgroundColor: "#151618", alignItems: "center", paddingVertical: 28, marginBottom: 16 },
  avatarContainer: { position: "relative", marginBottom: 16 },
  avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: "#6366F1" },
  avatarPlaceholder: { width: 88, height: 88, borderRadius: 44, backgroundColor: "#6366F1", justifyContent: "center", alignItems: "center", borderWidth: 3, borderColor: "#818CF8" },
  avatarInitials: { color: "#FFFFFF", fontSize: 30, fontWeight: "800" },
  cameraOverlay: { position: "absolute", bottom: 2, right: 2, backgroundColor: "#6366F1", width: 26, height: 26, borderRadius: 13, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#111214" },
  userName: { fontSize: 20, fontWeight: "800", color: "#F8FAFC", marginBottom: 4 },
  userEmail: { fontSize: 13, color: "#64748B", marginBottom: 12 },
  roleBadge: {},
  infoCard: { backgroundColor: "#151618", marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#94A3B8", marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.5 },
  infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#212225", gap: 10 },
  infoLabel: { color: "#64748B", fontSize: 13, flex: 1 },
  infoValue: { color: "#E2E8F0", fontSize: 13, fontWeight: "600", maxWidth: "55%" },
  permissionsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  superAdminBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#2E1065", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#7C3AED" },
  superAdminText: { color: "#D8B4FE", fontSize: 13, fontWeight: "600" },
  permChip: { backgroundColor: "#1A1A2E", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: "#312E81" },
  permChipText: { color: "#818CF8", fontSize: 11, fontWeight: "500" },
  adminCard: { backgroundColor: "#151618", marginBottom: 16 },
  adminLink: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#212225" },
  adminLinkText: { flex: 1, color: "#E2E8F0", fontSize: 14, fontWeight: "500" },
  versionRow: { alignItems: "center", marginVertical: 16 },
  versionText: { color: "#334155", fontSize: 12 },
  logoutBtn: { marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#111214", borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 18, borderBottomWidth: 1, borderBottomColor: "#2E3033" },
  modalTitle: { fontSize: 16, fontWeight: "700", color: "#F8FAFC" },
  modalBody: { padding: 18, paddingBottom: 36 },
  inputLabel: { fontSize: 13, color: "#94A3B8", fontWeight: "500", marginBottom: 6, marginTop: 4 },
  modalInput: { backgroundColor: "#0F0F10", borderWidth: 1, borderColor: "#2E3033", borderRadius: 8, paddingHorizontal: 14, height: 48, color: "#F8FAFC", fontSize: 15, marginBottom: 14 },
  roleChips: { flexDirection: "row", gap: 10, marginBottom: 20 },
  roleChip: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: "#1C1D20", borderWidth: 1, borderColor: "#2E3033", alignItems: "center" },
  roleChipActive: { backgroundColor: "#6366F1", borderColor: "#6366F1" },
  roleChipText: { fontSize: 13, color: "#94A3B8", fontWeight: "500" },
  roleChipTextActive: { color: "#FFFFFF", fontWeight: "600" },
  modalSaveBtn: { marginTop: 4 },
});
