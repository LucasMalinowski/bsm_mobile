import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Switch } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "../../../api/users";
import { useAuth } from "../../../auth/AuthProvider";
import { can } from "../../../auth/permissions";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Permission } from "../../../types/api";
import { useTheme } from "../../../contexts/ThemeContext";
import type { Colors } from "../../../constants/colors";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin", admin: "Administrador", employee: "Funcionário",
};

const ALL_PERMISSIONS: Permission[] = [
  "equipment:read", "equipment:create", "equipment:update", "equipment:delete",
  "ticket:read", "ticket:create", "ticket:update", "ticket:delete", "ticket:assign",
  "document:read", "document:upload", "document:update", "document:delete",
  "user:read", "user:invite", "user:update", "user:delete",
  "calibration:read", "calibration:manage", "calibration:register",
  "company:read", "company:update", "company:settings",
];

export default function UserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user: currentUser } = useAuth();
  const { colors: c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const queryClient = useQueryClient();
  const [showPermissions, setShowPermissions] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["user", id],
    queryFn: () => usersApi.getById(id),
  });

  const { data: permsData } = useQuery({
    queryKey: ["user-permissions", id],
    queryFn: () => usersApi.getPermissions(id),
    enabled: showPermissions,
  });

  const deactivateMutation = useMutation({
    mutationFn: (active: boolean) => usersApi.deactivate(id, active),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["user", id] }); queryClient.invalidateQueries({ queryKey: ["users"] }); },
    onError: (err: any) => Alert.alert("Erro", err.message || "Não foi possível alterar o status do usuário."),
  });

  const permsMutation = useMutation({
    mutationFn: (perms: Permission[]) => usersApi.updatePermissions(id, perms),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["user-permissions", id] }); Alert.alert("Sucesso", "Permissões atualizadas!"); },
    onError: (err: any) => Alert.alert("Erro", err.message || "Não foi possível salvar as permissões."),
  });

  const togglePermission = (perm: Permission, currentPerms: Permission[]) => {
    const next = currentPerms.includes(perm) ? currentPerms.filter((p) => p !== perm) : [...currentPerms, perm];
    permsMutation.mutate(next);
  };

  if (isLoading) return <View style={s.center}><ActivityIndicator size="large" color={c.primary} /></View>;

  if (isError || !data?.data) {
    return (
      <View style={s.center}>
        <Ionicons name="alert-circle-outline" size={48} color={c.error} />
        <Text style={s.errorText}>Erro ao carregar usuário.</Text>
        <TouchableOpacity onPress={() => refetch()} style={s.retryBtn}><Text style={s.retryText}>Tentar Novamente</Text></TouchableOpacity>
      </View>
    );
  }

  const profile = data.data;
  const isSelf = currentUser?.id === profile.id;
  const overrides = permsData?.data ?? [];

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: 12 + insets.top, minHeight: 64 + insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backAction}>
          <Ionicons name="arrow-back" size={24} color={c.headerText} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{profile.name}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <Card style={s.profileCard}>
          <View style={s.avatarBox}><Text style={s.avatarText}>{profile.name.slice(0, 2).toUpperCase()}</Text></View>
          <Text style={s.profileName}>{profile.name}</Text>
          <Text style={s.profileEmail}>{profile.email}</Text>
          <View style={s.rolePill}><Text style={s.rolePillText}>{ROLE_LABELS[profile.role] ?? profile.role}</Text></View>
          {!profile.is_active && (
            <View style={s.inactiveBanner}>
              <Ionicons name="ban-outline" size={14} color={c.error} />
              <Text style={s.inactiveBannerText}>Conta desativada</Text>
            </View>
          )}
        </Card>

        <Card style={s.infoCard}>
          <Text style={s.sectionTitle}>Informações</Text>
          <Row label="Função" value={ROLE_LABELS[profile.role] ?? profile.role} c={c} />
          <Row label="Status" value={profile.is_active ? "Ativo" : "Inativo"} c={c} />
          <Row label="Membro desde" value={new Date(profile.created_at).toLocaleDateString("pt-BR")} c={c} />
        </Card>

        {can(currentUser, "user:update") && !isSelf && (
          <Card style={s.infoCard}>
            <View style={s.toggleRow}>
              <View>
                <Text style={s.toggleLabel}>Conta Ativa</Text>
                <Text style={s.toggleHint}>{profile.is_active ? "Usuário pode acessar o sistema" : "Acesso bloqueado"}</Text>
              </View>
              <Switch value={profile.is_active} onValueChange={(v) => deactivateMutation.mutate(v)} disabled={deactivateMutation.isPending} trackColor={{ false: c.errorBg, true: c.primary }} thumbColor="#FFFFFF" />
            </View>
          </Card>
        )}

        {can(currentUser, "user:update") && (
          <Card style={s.infoCard}>
            <TouchableOpacity onPress={() => setShowPermissions((v) => !v)} style={s.permHeader}>
              <Text style={s.sectionTitle}>Permissões Individuais</Text>
              <Ionicons name={showPermissions ? "chevron-up" : "chevron-down"} size={18} color={c.textMuted} />
            </TouchableOpacity>
            {showPermissions && (
              <View style={s.permGrid}>
                {ALL_PERMISSIONS.map((perm) => {
                  const active = overrides.includes(perm);
                  return (
                    <TouchableOpacity key={perm} onPress={() => togglePermission(perm, overrides)} disabled={permsMutation.isPending} style={[s.permChip, active && s.permChipActive]}>
                      <Text style={[s.permChipText, active && s.permChipTextActive]}>{perm}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

function Row({ label, value, c }: { label: string; value: string; c: Colors }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.divider }}>
      <Text style={{ color: c.textMuted, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: c.text, fontSize: 13, fontWeight: "600" }}>{value}</Text>
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: c.bg, padding: 24 },
    errorText: { color: c.error, fontSize: 15, marginTop: 12, textAlign: "center", marginBottom: 16 },
    retryBtn: { backgroundColor: c.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
    retryText: { color: "#FFFFFF", fontWeight: "600" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: c.header, borderBottomWidth: 1, borderBottomColor: c.border, paddingHorizontal: 16, paddingBottom: 12 },
    backAction: { padding: 4 },
    headerTitle: { color: c.headerText, fontSize: 16, fontWeight: "700", maxWidth: "80%" },
    scroll: { padding: 16, paddingBottom: 40 },
    profileCard: { alignItems: "center", paddingVertical: 24, marginBottom: 16 },
    avatarBox: { width: 72, height: 72, borderRadius: 36, backgroundColor: c.primaryLight, justifyContent: "center", alignItems: "center", marginBottom: 12, borderWidth: 2, borderColor: c.primary },
    avatarText: { color: c.primary, fontSize: 24, fontWeight: "800" },
    profileName: { fontSize: 18, fontWeight: "800", color: c.text, marginBottom: 4 },
    profileEmail: { fontSize: 13, color: c.textMuted, marginBottom: 10 },
    rolePill: { backgroundColor: c.primaryLight, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: c.primaryBorder },
    rolePillText: { color: c.primary, fontSize: 12, fontWeight: "600" },
    inactiveBanner: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, backgroundColor: c.errorBg, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
    inactiveBannerText: { color: c.error, fontSize: 12, fontWeight: "600" },
    infoCard: { marginBottom: 16 },
    sectionTitle: { fontSize: 13, fontWeight: "700", color: c.textSub, textTransform: "uppercase", letterSpacing: 0.5 },
    toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    toggleLabel: { color: c.text, fontSize: 14, fontWeight: "600" },
    toggleHint: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    permHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    permGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
    permChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border },
    permChipActive: { backgroundColor: c.primaryLight, borderColor: c.primary },
    permChipText: { color: c.textMuted, fontSize: 11, fontWeight: "500" },
    permChipTextActive: { color: c.primary, fontWeight: "700" },
  });
}
