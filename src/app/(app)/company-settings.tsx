import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/AuthProvider";
import { can } from "../../auth/permissions";
import { companyApi } from "../../api/company";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";

const schema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  cnpj: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function CompanySettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const companyId = user?.company_id;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["company", companyId],
    queryFn: () => companyApi.get(companyId!),
    enabled: !!companyId,
  });

  const { control, handleSubmit, reset, formState: { errors, isDirty } } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    values: data?.data ? { name: data.data.name, cnpj: data.data.cnpj ?? "" } : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: (vals: FormValues) => companyApi.update(companyId!, { name: vals.name, cnpj: vals.cnpj || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company", companyId] });
      Alert.alert("Sucesso", "Dados da empresa atualizados!");
      reset(undefined, { keepValues: true });
    },
    onError: (err: any) => Alert.alert("Erro", err.message || "Não foi possível atualizar os dados."),
  });

  if (!companyId) {
    return (
      <View style={s.container}>
        <View style={[s.header, { paddingTop: 12 + insets.top, minHeight: 64 + insets.top }]}>
          <TouchableOpacity onPress={() => router.back()} style={s.backAction}>
            <Ionicons name="arrow-back" size={24} color="#F8FAFC" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Empresa</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={s.center}>
          <Text style={s.errorText}>Nenhuma empresa associada à conta.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backAction}>
          <Ionicons name="arrow-back" size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Configurações da Empresa</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {isLoading ? (
          <View style={s.center}><ActivityIndicator size="large" color="#6366F1" /></View>
        ) : isError ? (
          <View style={s.center}>
            <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
            <Text style={s.errorText}>Erro ao carregar dados da empresa.</Text>
          </View>
        ) : (
          <>
            <Card style={s.card}>
              <Text style={s.sectionTitle}>Dados da Empresa</Text>

              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Nome da Empresa *"
                    placeholder="Nome da empresa"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    error={errors.name?.message}
                    editable={can(user, "company:settings")}
                  />
                )}
              />

              <Controller
                control={control}
                name="cnpj"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="CNPJ"
                    placeholder="00.000.000/0000-00"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value ?? ""}
                    keyboardType="numeric"
                    editable={user?.role === "super_admin"}
                  />
                )}
              />

              {data?.data.slug && (
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Slug</Text>
                  <Text style={s.infoValue}>{data.data.slug}</Text>
                </View>
              )}
            </Card>

            {can(user, "company:settings") && (
              <Button
                title="Salvar Alterações"
                onPress={handleSubmit((d) => updateMutation.mutate(d))}
                loading={updateMutation.isPending}
                disabled={!isDirty}
              />
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F0F10" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#111214", borderBottomWidth: 1, borderBottomColor: "#2E3033", paddingHorizontal: 16, paddingBottom: 12 },
  backAction: { padding: 4 },
  headerTitle: { color: "#F8FAFC", fontSize: 16, fontWeight: "700" },
  scroll: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 48 },
  errorText: { color: "#EF4444", fontSize: 14, marginTop: 12 },
  card: { backgroundColor: "#151618", marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#212225", marginTop: 4 },
  infoLabel: { color: "#64748B", fontSize: 13 },
  infoValue: { color: "#E2E8F0", fontSize: 13, fontWeight: "600" },
});
