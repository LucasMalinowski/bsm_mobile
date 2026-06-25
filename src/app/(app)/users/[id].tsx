import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Switch } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "../../../api/users";
import { useAuth } from "../../../auth/AuthProvider";
import { can } from "../../../auth/permissions";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Permission } from "../../../types/api";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Administrador",
  employee: "Funcionário",
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
  const { user: currentUser } = useAuth();
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", id] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: any) => Alert.alert("Erro", err.message || "Não foi possível alterar o status do usuário."),
  });

  const permsMutation = useMutation({
    mutationFn: (perms: Permission[]) => usersApi.updatePermissions(id, perms),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-permissions", id] });
      Alert.alert("Sucesso", "Permissões atualizadas!");
    },
    onError: (err: any) => Alert.alert("Erro", err.message || "Não foi possível salvar as permissões."),
  });

  const togglePermission = (perm: Permission, currentPerms: Permission[]) => {
    const next = currentPerms.includes(perm)
      ? currentPerms.filter((p) => p !== perm)
      : [...currentPerms, perm];
    permsMutation.mutate(next);
  };

  if (isLoading) {
    return <View style={s.center}><ActivityIndicator size="large" color="#6366F1" /></View>;
  }

  if (isError || !data?.data) {
    return (
      <View style={s.center}>
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text style={s.errorText}>Erro ao carregar usuário.</Text>
        <TouchableOpacity onPress={() => refetch()} style={s.retryBtn}>
          <Text style={s.retryText}>Tentar Novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const profile = data.data;
  const isSelf = currentUser?.id === profile.id;
  const overrides = permsData?.data ?? [];

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backAction}>
          <Ionicons name="arrow-back" size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{profile.name}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {/* Profile Card */}
        <Card style={s.profileCard}>
          <View style={s.avatarBox}>
            <Text style={s.avatarText}>{profile.name.slice(0, 2).toUpperCase()}</Text>
          </View>
          <Text style={s.profileName}>{profile.name}</Text>
          <Text style={s.profileEmail}>{profile.email}</Text>
          <View style={s.rolePill}>
            <Text style={s.rolePillText}>{ROLE_LABELS[profile.role] ?? profile.role}</Text>
          </View>
          {!profile.is_active && (
            <View style={s.inactiveBanner}>
              <Ionicons name="ban-outline" size={14} color="#EF4444" />
              <Text style={s.inactiveBannerText}>Conta desativada</Text>
            </View>
          )}
        </Card>

        {/* Info */}
        <Card style={s.infoCard}>
          <Text style={s.sectionTitle}>Informações</Text>
          <Row label="Função" value={ROLE_LABELS[profile.role] ?? profile.role} />
          <Row label="Status" value={profile.is_active ? "Ativo" : "Inativo"} />
          <Row label="Membro desde" value={new Date(profile.created_at).toLocaleDateString("pt-BR")} />
        </Card>

        {/* Deactivate toggle (admin only, not self) */}
        {can(currentUser, "user:update") && !isSelf && (
          <Card style={s.infoCard}>
            <View style={s.toggleRow}>
              <View>
                <Text style={s.toggleLabel}>Conta Ativa</Text>
                <Text style={s.toggleHint}>
                  {profile.is_active ? "Usuário pode acessar o sistema" : "Acesso bloqueado"}
                </Text>
              </View>
              <Switch
                value={profile.is_active}
                onValueChange={(v) => deactivateMutation.mutate(v)}
                disabled={deactivateMutation.isPending}
                trackColor={{ false: "#EF444420", true: "#6366F1" }}
                thumbColor="#FFFFFF"
              />
            </View>
          </Card>
        )}

        {/* Permission overrides */}
        {can(currentUser, "user:update") && (
          <Card style={s.infoCard}>
            <TouchableOpacity onPress={() => setShowPermissions((v) => !v)} style={s.permHeader}>
              <Text style={s.sectionTitle}>Permissões Individuais</Text>
              <Ionicons name={showPermissions ? "chevron-up" : "chevron-down"} size={18} color="#64748B" />
            </TouchableOpacity>

            {showPermissions && (
              <View style={s.permGrid}>
                {ALL_PERMISSIONS.map((perm) => {
                  const active = overrides.includes(perm);
                  return (
                    <TouchableOpacity
                      key={perm}
                      onPress={() => togglePermission(perm, overrides)}
                      disabled={permsMutation.isPending}
                      style={[s.permChip, active && s.permChipActive]}
                    >
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F0F10" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F0F10", padding: 24 },
  errorText: { color: "#EF4444", fontSize: 15, marginTop: 12, textAlign: "center", marginBottom: 16 },
  retryBtn: { backgroundColor: "#6366F1", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: "#FFFFFF", fontWeight: "600" },
  header: { height: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#111214", borderBottomWidth: 1, borderBottomColor: "#2E3033", paddingHorizontal: 16, paddingTop: 12 },
  backAction: { padding: 4 },
  headerTitle: { color: "#F8FAFC", fontSize: 16, fontWeight: "700", maxWidth: "80%" },
  scroll: { padding: 16, paddingBottom: 40 },
  profileCard: { backgroundColor: "#151618", alignItems: "center", paddingVertical: 24, marginBottom: 16 },
  avatarBox: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#1A1A2E", justifyContent: "center", alignItems: "center", marginBottom: 12, borderWidth: 2, borderColor: "#6366F1" },
  avatarText: { color: "#818CF8", fontSize: 24, fontWeight: "800" },
  profileName: { fontSize: 18, fontWeight: "800", color: "#F8FAFC", marginBottom: 4 },
  profileEmail: { fontSize: 13, color: "#64748B", marginBottom: 10 },
  rolePill: { backgroundColor: "#1A1A2E", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: "#312E81" },
  rolePillText: { color: "#818CF8", fontSize: 12, fontWeight: "600" },
  inactiveBanner: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, backgroundColor: "#450A0A", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  inactiveBannerText: { color: "#EF4444", fontSize: 12, fontWeight: "600" },
  infoCard: { backgroundColor: "#151618", marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#212225" },
  rowLabel: { color: "#64748B", fontSize: 13 },
  rowValue: { color: "#E2E8F0", fontSize: 13, fontWeight: "600" },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  toggleLabel: { color: "#E2E8F0", fontSize: 14, fontWeight: "600" },
  toggleHint: { color: "#64748B", fontSize: 12, marginTop: 2 },
  permHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  permGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  permChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: "#1C1D20", borderWidth: 1, borderColor: "#2E3033" },
  permChipActive: { backgroundColor: "#6366F120", borderColor: "#6366F1" },
  permChipText: { color: "#64748B", fontSize: 11, fontWeight: "500" },
  permChipTextActive: { color: "#818CF8", fontWeight: "700" },
});
