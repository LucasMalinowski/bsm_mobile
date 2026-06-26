import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
} from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "expo-router";
import { useAuth } from "../../auth/AuthProvider";
import { Button } from "../../components/ui/Button";
import { Ionicons } from "@expo/vector-icons";

const loginSchema = z.object({
  email: z.string().min(1, "O e-mail é obrigatório").email("Formato de e-mail inválido"),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setLoading(true);
    setApiError(null);
    try {
      await login(data.email, data.password);
    } catch (err: any) {
      setApiError(err.message || "E-mail ou senha incorretos, ou erro de rede.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo section */}
        <View style={styles.logoSection}>
          <View style={styles.logoBox}>
            <Image
              source={require("../../../assets/logo.png")}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.brand}>BSM</Text>
          <Text style={styles.subtitle}>GESTÃO DE EQUIPAMENTOS</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {apiError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{apiError}</Text>
            </View>
          )}

          {/* Email */}
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.fieldContainer}>
                <View style={[styles.inputWrapper, errors.email && styles.inputWrapperError]}>
                  <Ionicons name="mail-outline" size={18} color="rgba(255,255,255,0.5)" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="seu@email.com"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                {errors.email && <Text style={styles.fieldError}>{errors.email.message}</Text>}
              </View>
            )}
          />

          {/* Password */}
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.fieldContainer}>
                <View style={[styles.inputWrapper, errors.password && styles.inputWrapperError]}>
                  <Ionicons name="lock-closed-outline" size={18} color="rgba(255,255,255,0.5)" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={18}
                      color="rgba(255,255,255,0.5)"
                    />
                  </TouchableOpacity>
                </View>
                {errors.password && <Text style={styles.fieldError}>{errors.password.message}</Text>}
              </View>
            )}
          />

          <TouchableOpacity
            onPress={() => router.push("/(auth)/forgot-password" as any)}
            style={styles.forgotBtn}
          >
            <Text style={styles.forgotText}>Esqueceu sua senha?</Text>
          </TouchableOpacity>

          <Button
            title="Entrar"
            onPress={handleSubmit(onSubmit)}
            loading={loading}
            style={styles.submitBtn}
          />
        </View>

        {/* Lab illustration */}
        <View style={styles.illustrationRow}>
          <Image
            source={require("../../../assets/login-microscope.png")}
            style={styles.illustrationImg}
            resizeMode="contain"
          />
          <Image
            source={require("../../../assets/login-flask.png")}
            style={styles.illustrationImg}
            resizeMode="contain"
          />
          <Image
            source={require("../../../assets/login-multimeter.png")}
            style={styles.illustrationImg}
            resizeMode="contain"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#071426",
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 70,
    paddingBottom: 20,
  },
  logoSection: {
    alignItems: "center",
    marginBottom: 44,
  },
  logoBox: {
    width: 76,
    height: 76,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    overflow: "hidden",
  },
  logoImage: {
    width: 60,
    height: 60,
  },
  brand: {
    fontSize: 34,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 3,
  },
  subtitle: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    marginTop: 4,
    letterSpacing: 1.5,
  },
  form: {
    width: "100%",
  },
  errorBanner: {
    backgroundColor: "rgba(239,68,68,0.15)",
    borderColor: "#EF4444",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    color: "#FCA5A5",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  fieldContainer: {
    marginBottom: 12,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 14,
  },
  inputWrapperError: {
    borderColor: "#EF4444",
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: "#ffffff",
    fontSize: 15,
    height: "100%",
  },
  eyeBtn: {
    padding: 6,
  },
  fieldError: {
    color: "#FCA5A5",
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  forgotBtn: {
    alignSelf: "flex-end",
    paddingVertical: 8,
    marginBottom: 4,
  },
  forgotText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    fontWeight: "500",
  },
  submitBtn: {
    height: 52,
    borderRadius: 12,
    marginVertical: 0,
  },
  illustrationRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    marginTop: 36,
    gap: 12,
  },
  illustrationImg: {
    width: 88,
    height: 100,
    opacity: 0.55,
  },
});
