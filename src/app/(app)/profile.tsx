import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Alert, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform, Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { useTheme } from "../../contexts/ThemeContext";

export default function ProfileScreen() {
  const { user, logout, updateUser, activeCompanyId } = useAuth();
  const { colors: c, isDark, toggleTheme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => makeStyles(c), [c]);

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
      <View style={[s.header, { paddingTop: 12 + insets.top, minHeight: 64 + insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backAction}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
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
                <ActivityIndicator size="small" color="#ffffff" />
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
          <InfoRow c={c} icon="person-outline" label="Nome Completo" value={user.name} />
          <InfoRow c={c} icon="mail-outline" label="E-mail" value={user.email} />
          <InfoRow c={c} icon="shield-checkmark-outline" label="Função" value={user.role === "super_admin" ? "Super Administrador" : user.role === "admin" ? "Administrador" : "Funcionário"} />
          {user.company_id && (
            <InfoRow c={c} icon="business-outline" label="ID da Empresa" value={user.company_id.slice(0, 8) + "..."} last />
          )}
        </Card>

        {/* Permissions summary */}
        <Card style={s.infoCard}>
          <Text style={s.sectionTitle}>Permissões Ativas ({user.permissions.length})</Text>
          <View style={s.permissionsWrap}>
            {user.role === "super_admin" ? (
              <View style={s.superAdminBadge}>
                <Ionicons name="infinite-outline" size={14} color={c.primary} />
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
          <Card style={s.infoCard}>
            <Text style={s.sectionTitle}>Administração</Text>
            {user.role === "super_admin" && (
              <AdminLink c={c} icon="business-outline" label={activeCompanyData?.data?.name ?? "Selecionar Empresa"} onPress={() => router.push("/(app)/select-company" as any)} />
            )}
            {can(user, "user:read") && (
              <AdminLink c={c} icon="people-outline" label="Gerenciar Usuários" onPress={() => router.push("/(app)/users/" as any)} />
            )}
            {can(user, "user:invite") && (
              <AdminLink c={c} icon="mail-outline" label="Convidar Usuário" onPress={() => setInviteModalVisible(true)} last />
            )}
          </Card>
        )}

        {/* Settings */}
        <Card style={s.infoCard}>
          <Text style={s.sectionTitle}>Configurações</Text>

          {/* Theme toggle */}
          <View style={s.themeRow}>
            <Ionicons name={isDark ? "moon-outline" : "sunny-outline"} size={18} color={c.textSub} />
            <Text style={s.adminLinkText}>{isDark ? "Tema Escuro" : "Tema Claro"}</Text>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: c.border, true: c.primaryLight }}
              thumbColor={isDark ? c.primary : c.textMuted}
            />
          </View>

          <AdminLink c={c} icon="notifications-outline" label="Notificações" onPress={() => router.push("/(app)/notification-preferences" as any)} />
          {can(user, "company:settings") && (
            <AdminLink c={c} icon="business-outline" label="Empresa" onPress={() => router.push("/(app)/company-settings" as any)} last />
          )}
        </Card>

        <View style={s.versionRow}>
          <Text style={s.versionText}>BSM Mobile · v1.0.0</Text>
        </View>

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
                <Ionicons name="close" size={22} color={c.textSub} />
              </TouchableOpacity>
            </View>

            <View style={s.modalBody}>
              <Text style={s.inputLabel}>Nome Completo *</Text>
              <TextInput
                value={inviteName}
                onChangeText={setInviteName}
                placeholder="Nome do usuário"
                placeholderTextColor={c.textMuted}
                style={s.modalInput}
                autoCapitalize="words"
              />

              <Text style={s.inputLabel}>E-mail *</Text>
              <TextInput
                value={inviteEmail}
                onChangeText={setInviteEmail}
                placeholder="email@empresa.com"
                placeholderTextColor={c.textMuted}
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

function InfoRow({ c, icon, label, value, last }: { c: any; icon: string; label: string; value: string; last?: boolean }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 10 }, !last && { borderBottomWidth: 1, borderBottomColor: c.divider }]}>
      <Ionicons name={icon as any} size={16} color={c.textMuted} />
      <Text style={{ color: c.textSub, fontSize: 13, flex: 1 }}>{label}</Text>
      <Text style={{ color: c.text, fontSize: 13, fontWeight: "600", maxWidth: "55%" }} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function AdminLink({ c, icon, label, onPress, last }: { c: any; icon: string; label: string; onPress: () => void; last?: boolean }) {
  return (
    <TouchableOpacity
      style={[{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 }, !last && { borderBottomWidth: 1, borderBottomColor: c.divider }]}
      onPress={onPress}
    >
      <Ionicons name={icon as any} size={18} color={c.textSub} />
      <Text style={{ flex: 1, color: c.text, fontSize: 14, fontWeight: "500" }}>{label}</Text>
      <Ionicons name="chevron-forward" size={14} color={c.textMuted} />
    </TouchableOpacity>
  );
}

function makeStyles(c: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#0363a9", paddingHorizontal: 16, paddingBottom: 12 },
    backAction: { padding: 4 },
    headerTitle: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
    scroll: { padding: 16, paddingBottom: 48 },
    avatarCard: { alignItems: "center", paddingVertical: 28, marginBottom: 16 },
    avatarContainer: { position: "relative", marginBottom: 16 },
    avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: c.primary },
    avatarPlaceholder: { width: 88, height: 88, borderRadius: 44, backgroundColor: c.primary, justifyContent: "center", alignItems: "center", borderWidth: 3, borderColor: c.primaryBorder },
    avatarInitials: { color: "#FFFFFF", fontSize: 30, fontWeight: "800" },
    cameraOverlay: { position: "absolute", bottom: 2, right: 2, backgroundColor: c.primary, width: 26, height: 26, borderRadius: 13, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: c.surface },
    userName: { fontSize: 20, fontWeight: "800", color: c.text, marginBottom: 4 },
    userEmail: { fontSize: 13, color: c.textMuted, marginBottom: 12 },
    roleBadge: {},
    infoCard: { marginBottom: 16 },
    sectionTitle: { fontSize: 12, fontWeight: "700", color: c.textSub, marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.5 },
    permissionsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    superAdminBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.primaryLight, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: c.primaryBorder },
    superAdminText: { color: c.primary, fontSize: 13, fontWeight: "600" },
    permChip: { backgroundColor: c.surface2, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: c.border },
    permChipText: { color: c.textSub, fontSize: 11, fontWeight: "500" },
    themeRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.divider },
    adminLinkText: { flex: 1, color: c.text, fontSize: 14, fontWeight: "500" },
    versionRow: { alignItems: "center", marginVertical: 16 },
    versionText: { color: c.textMuted, fontSize: 12 },
    logoutBtn: { marginTop: 4 },
    modalOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: "flex-end" },
    modalSheet: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
    modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 18, borderBottomWidth: 1, borderBottomColor: c.border },
    modalTitle: { fontSize: 16, fontWeight: "700", color: c.text },
    modalBody: { padding: 18, paddingBottom: 36 },
    inputLabel: { fontSize: 13, color: c.textSub, fontWeight: "500", marginBottom: 6, marginTop: 4 },
    modalInput: { backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingHorizontal: 14, height: 48, color: c.text, fontSize: 15, marginBottom: 14 },
    roleChips: { flexDirection: "row", gap: 10, marginBottom: 20 },
    roleChip: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, alignItems: "center" },
    roleChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    roleChipText: { fontSize: 13, color: c.textSub, fontWeight: "500" },
    roleChipTextActive: { color: "#FFFFFF", fontWeight: "600" },
    modalSaveBtn: { marginTop: 4 },
  });
}
