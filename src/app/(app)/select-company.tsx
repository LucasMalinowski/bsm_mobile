import React from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { companyApi } from "../../api/company";
import { Card } from "../../components/ui/Card";
import { useAuth } from "../../auth/AuthProvider";

export default function SelectCompanyScreen() {
  const router = useRouter();
  const { activeCompanyId, setActiveCompanyId } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["companies", "all"],
    queryFn: () => companyApi.listAll(),
  });

  const companies = data?.data ?? [];

  const select = async (companyId: string | null) => {
    await setActiveCompanyId(companyId);
    router.back();
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backAction}>
          <Ionicons name="arrow-back" size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Selecionar Empresa</Text>
      </View>

      <Text style={s.helperText}>
        Como Super Admin, escolha em qual empresa deseja operar. Equipamentos, chamados e documentos serão filtrados por essa empresa.
      </Text>

      {isLoading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#6366F1" /></View>
      ) : isError ? (
        <View style={s.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={s.errorText}>Erro ao carregar empresas.</Text>
          <TouchableOpacity onPress={() => refetch()} style={s.retryBtn}>
            <Text style={s.retryText}>Tentar Novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={companies}
          keyExtractor={(c) => c.id}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => select(item.id)} activeOpacity={0.8}>
              <Card style={{ ...s.companyCard, ...(activeCompanyId === item.id ? s.activeCard : {}) }}>
                <View style={s.companyMeta}>
                  <Text style={s.companyName}>{item.name}</Text>
                  <Text style={s.companySlug}>{item.slug}</Text>
                </View>
                {activeCompanyId === item.id && (
                  <Ionicons name="checkmark-circle" size={20} color="#6366F1" />
                )}
              </Card>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={s.emptyBox}>
              <Ionicons name="business-outline" size={48} color="#475569" />
              <Text style={s.emptyText}>Nenhuma empresa encontrada.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F0F10" },
  header: { height: 64, flexDirection: "row", alignItems: "center", backgroundColor: "#111214", borderBottomWidth: 1, borderBottomColor: "#2E3033", paddingHorizontal: 16, paddingTop: 12 },
  backAction: { padding: 4 },
  headerTitle: { color: "#F8FAFC", fontSize: 16, fontWeight: "700", marginLeft: 12 },
  helperText: { color: "#64748B", fontSize: 12, padding: 16, lineHeight: 18 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  errorText: { color: "#EF4444", fontSize: 14, marginTop: 12, textAlign: "center" },
  retryBtn: { marginTop: 16, backgroundColor: "#6366F1", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: "#FFFFFF", fontWeight: "600" },
  list: { padding: 12, paddingBottom: 32 },
  companyCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#151618", marginBottom: 10 },
  activeCard: { borderColor: "#6366F1", borderWidth: 1 },
  companyMeta: { flex: 1 },
  companyName: { color: "#E2E8F0", fontSize: 14, fontWeight: "700" },
  companySlug: { color: "#64748B", fontSize: 12, marginTop: 2 },
  emptyBox: { alignItems: "center", paddingVertical: 48 },
  emptyText: { color: "#475569", fontSize: 14, marginTop: 12 },
});
