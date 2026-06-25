import React, { useState } from "react";
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { authApi } from "../../api/auth";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";

const schema = z.object({
  email: z.string().min(1, "E-mail é obrigatório").email("Formato de e-mail inválido"),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = async ({ email }: FormValues) => {
    setLoading(true);
    setApiError(null);
    try {
      await authApi.resetPassword(email);
      setSent(true);
    } catch (err: any) {
      setApiError(err.message || "Não foi possível enviar o e-mail de redefinição.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#94A3B8" />
          <Text style={s.backText}>Voltar</Text>
        </TouchableOpacity>

        <View style={s.header}>
          <Ionicons name="lock-open-outline" size={48} color="#6366F1" />
          <Text style={s.title}>Recuperar Senha</Text>
          <Text style={s.subtitle}>
            Informe seu e-mail para receber o link de redefinição de senha.
          </Text>
        </View>

        <View style={s.card}>
          {sent ? (
            <View style={s.successBox}>
              <Ionicons name="checkmark-circle-outline" size={40} color="#34D399" />
              <Text style={s.successTitle}>E-mail enviado!</Text>
              <Text style={s.successText}>
                Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
              </Text>
              <Button title="Voltar ao Login" onPress={() => router.replace("/(auth)/login")} style={s.submitBtn} />
            </View>
          ) : (
            <>
              {apiError && (
                <View style={s.errorBanner}>
                  <Text style={s.errorText}>{apiError}</Text>
                </View>
              )}

              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Endereço de E-mail"
                    placeholder="exemplo@empresa.com"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    error={errors.email?.message}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                )}
              />

              <Button
                title="Enviar Link de Redefinição"
                onPress={handleSubmit(onSubmit)}
                loading={loading}
                style={s.submitBtn}
              />
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0B0C" },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 40 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 32 },
  backText: { color: "#94A3B8", fontSize: 14 },
  header: { alignItems: "center", marginBottom: 32 },
  title: { fontSize: 24, fontWeight: "800", color: "#F8FAFC", marginTop: 16, letterSpacing: 0.5 },
  subtitle: { fontSize: 14, color: "#64748B", marginTop: 8, textAlign: "center", lineHeight: 20 },
  card: { backgroundColor: "#111214", borderRadius: 16, borderWidth: 1, borderColor: "#2E3033", padding: 24 },
  errorBanner: { backgroundColor: "#450A0A", borderColor: "#EF4444", borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { color: "#FCA5A5", fontSize: 13, fontWeight: "500", textAlign: "center" },
  submitBtn: { marginTop: 16 },
  successBox: { alignItems: "center", paddingVertical: 8 },
  successTitle: { fontSize: 18, fontWeight: "700", color: "#F8FAFC", marginTop: 12 },
  successText: { fontSize: 13, color: "#64748B", textAlign: "center", lineHeight: 20, marginTop: 8, marginBottom: 24 },
});
