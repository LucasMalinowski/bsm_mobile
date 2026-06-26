import React, { useMemo } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { companyApi } from "../../api/company";
import { Card } from "../../components/ui/Card";
import { useAuth } from "../../auth/AuthProvider";
import { useTheme } from "../../contexts/ThemeContext";
import type { Colors } from "../../constants/colors";

export default function SelectCompanyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeCompanyId, setActiveCompanyId } = useAuth();
  const { colors: c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);

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
      <View style={[s.header, { paddingTop: 12 + insets.top, minHeight: 64 + insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backAction}>
          <Ionicons name="arrow-back" size={24} color={c.headerText} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Selecionar Empresa</Text>
      </View>

      <Text style={s.helperText}>
        Como Super Admin, escolha em qual empresa deseja operar. Equipamentos, chamados e documentos serão filtrados por essa empresa.
      </Text>

      {isLoading ? (
        <View style={s.center}><ActivityIndicator size="large" color={c.primary} /></View>
      ) : isError ? (
        <View style={s.center}>
          <Ionicons name="alert-circle-outline" size={48} color={c.error} />
          <Text style={s.errorText}>Erro ao carregar empresas.</Text>
          <TouchableOpacity onPress={() => refetch()} style={s.retryBtn}><Text style={s.retryText}>Tentar Novamente</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={companies}
          keyExtractor={(co) => co.id}
          contentContainerStyle={s.list}
          ListHeaderComponent={
            <TouchableOpacity onPress={() => select(null)} activeOpacity={0.8}>
              <Card style={{ ...s.companyCard, ...(activeCompanyId === null ? s.activeCard : {}) }}>
                <View style={s.companyMeta}>
                  <Text style={s.companyName}>Sem empresa selecionada</Text>
                  <Text style={s.companySlug}>Visualização global (Super Admin)</Text>
                </View>
                {activeCompanyId === null && <Ionicons name="checkmark-circle" size={20} color={c.primary} />}
              </Card>
            </TouchableOpacity>
          }
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => select(item.id)} activeOpacity={0.8}>
              <Card style={{ ...s.companyCard, ...(activeCompanyId === item.id ? s.activeCard : {}) }}>
                <View style={s.companyMeta}>
                  <Text style={s.companyName}>{item.name}</Text>
                  <Text style={s.companySlug}>{item.slug}</Text>
                </View>
                {activeCompanyId === item.id && <Ionicons name="checkmark-circle" size={20} color={c.primary} />}
              </Card>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={s.emptyBox}>
              <Ionicons name="business-outline" size={48} color={c.textMuted} />
              <Text style={s.emptyText}>Nenhuma empresa encontrada.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: { flexDirection: "row", alignItems: "center", backgroundColor: c.header, borderBottomWidth: 1, borderBottomColor: c.border, paddingHorizontal: 16, paddingBottom: 12 },
    backAction: { padding: 4 },
    headerTitle: { color: c.headerText, fontSize: 16, fontWeight: "700", marginLeft: 12 },
    helperText: { color: c.textMuted, fontSize: 12, padding: 16, lineHeight: 18 },
    center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
    errorText: { color: c.error, fontSize: 14, marginTop: 12, textAlign: "center" },
    retryBtn: { marginTop: 16, backgroundColor: c.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
    retryText: { color: "#FFFFFF", fontWeight: "600" },
    list: { padding: 12, paddingBottom: 32 },
    companyCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
    activeCard: { borderColor: c.primary, borderWidth: 2 },
    companyMeta: { flex: 1 },
    companyName: { color: c.text, fontSize: 14, fontWeight: "700" },
    companySlug: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    emptyBox: { alignItems: "center", paddingVertical: 48 },
    emptyText: { color: c.textMuted, fontSize: 14, marginTop: 12 },
  });
}
