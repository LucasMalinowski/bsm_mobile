import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  TextInput, ScrollView, KeyboardAvoidingView, Platform, FlatList, Alert,
} from "react-native";
import { Camera, CameraView } from "expo-camera";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { equipmentApi } from "../../../api/equipment";
import { apiFetch } from "../../../api/client";
import { tokenStorage } from "../../../auth/tokenStorage";
import type { Equipment } from "../../../types/api";

const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const QR_TOKEN_REGEX = /\/equipment\/qr\/([^/?#]+)/;
const RECENT_KEY = "bsm_recent_scans";
const MAX_RECENT = 10;
const SEARCH_DEBOUNCE_MS = 300;

type RecentScan = { id: string; label: string; ts: number };

async function loadRecents(): Promise<RecentScan[]> {
  try {
    const raw = await SecureStore.getItemAsync(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function pushRecent(id: string, label: string) {
  const existing = await loadRecents();
  const filtered = existing.filter((s) => s.id !== id);
  const updated: RecentScan[] = [{ id, label, ts: Date.now() }, ...filtered].slice(0, MAX_RECENT);
  await SecureStore.setItemAsync(RECENT_KEY, JSON.stringify(updated));
}

export default function ScanTabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [searchResults, setSearchResults] = useState<Equipment[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Camera.requestCameraPermissionsAsync().then(({ status }) => {
      setHasPermission(status === "granted");
    });
    loadRecents().then(setRecentScans);
  }, []);

  const navigateToEquipment = useCallback(
    async (id: string, label = id.slice(0, 8)) => {
      await pushRecent(id, label);
      setRecentScans(await loadRecents());
      router.push(`/(app)/equipment/${id}` as any);
    },
    [router]
  );

  const handleBarCodeScanned = async ({ data }: { type: string; data: string }) => {
    if (scanned || resolving) return;
    setScanned(true);

    // QR token URL — resolve token via API
    const tokenMatch = data.match(QR_TOKEN_REGEX);
    if (tokenMatch) {
      const token = tokenMatch[1];
      setResolving(true);
      try {
        const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3000";
        const session = await tokenStorage.loadSession();
        const resp = await fetch(`${BASE_URL}/api/equipment/qr/${token}`, {
          headers: {
            Accept: "application/json",
            ...(session.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
          },
        });

        // New backend: returns JSON { equipment_id }
        const contentType = resp.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          const json = await resp.json().catch(() => ({}));
          const equipmentId = json.equipment_id ?? json.data?.equipment_id;
          if (equipmentId) {
            navigateToEquipment(equipmentId);
            return;
          }
        }

        // Old backend (or current Vercel deploy): redirects to /equipment/UUID
        // resp.url is the final URL after fetch follows the redirect
        const finalUrlMatch = resp.url.match(/\/equipment\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
        if (finalUrlMatch) {
          navigateToEquipment(finalUrlMatch[1]);
          return;
        }
      } catch {
        // network error — fall through to manual input
      } finally {
        setResolving(false);
      }
      setShowManualInput(true);
      return;
    }

    // Direct UUID in QR data (no URL wrapping)
    const uuidMatch = data.match(UUID_REGEX);
    if (uuidMatch) {
      navigateToEquipment(uuidMatch[0]);
      return;
    }

    setShowManualInput(true);
  };

  // Live search with debounce
  const handleSearchChange = (text: string) => {
    setManualCode(text);
    setSearchError(null);
    setSearchResults([]);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = text.trim();
    if (!trimmed) return;

    // If it's a UUID, navigate immediately
    if (UUID_REGEX.test(trimmed)) {
      navigateToEquipment(trimmed);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await equipmentApi.list({ search: trimmed, limit: 10 });
        setSearchResults(res.data ?? []);
        if ((res.data ?? []).length === 0) {
          setSearchError("Nenhum equipamento encontrado.");
        }
      } catch (e: any) {
        setSearchError(e.message || "Erro ao buscar equipamento.");
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
  };

  if (hasPermission === null) {
    return (
      <View style={s.centerContainer}>
        <ActivityIndicator size="large" color="#0363a9" />
        <Text style={s.permissionText}>Solicitando permissão da câmera...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={s.centerContainer}>
        <Ionicons name="camera-reverse-outline" size={48} color="#EF4444" />
        <Text style={s.errorText}>Acesso à câmera foi negado nas configurações.</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
      >
        <View style={s.overlay}>
          {/* Header */}
          <View style={[s.header, { paddingTop: 12 + insets.top, height: 60 + insets.top }]}>
            <Text style={s.headerTitle}>Leitor QR Code</Text>
            <TouchableOpacity
              onPress={() => { setShowManualInput((v) => !v); setScanned(true); }}
              style={s.iconBtn}
            >
              <Ionicons name="keypad-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Scanner frame */}
          <View style={s.maskContainer}>
            <View style={s.maskSide} />
            <View style={s.maskCenter}>
              <View style={s.scanFrame}>
                <View style={[s.corner, s.cornerTL]} />
                <View style={[s.corner, s.cornerTR]} />
                <View style={[s.corner, s.cornerBL]} />
                <View style={[s.corner, s.cornerBR]} />
                {resolving && (
                  <View style={s.resolvingLoader}>
                    <ActivityIndicator size="small" color="#0363a9" />
                    <Text style={s.resolvingText}>Identificando...</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={s.maskSide} />
          </View>

          {/* Footer */}
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <View style={s.footer}>
              {showManualInput ? (
                <>
                  <Text style={s.manualTitle}>Busca Manual</Text>
                  <View style={s.inputRow}>
                    <TextInput
                      value={manualCode}
                      onChangeText={handleSearchChange}
                      placeholder="Digite o código ou nome do equipamento"
                      placeholderTextColor="#64748B"
                      style={s.manualInput}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="search"
                    />
                    {searching && (
                      <View style={s.searchIndicator}>
                        <ActivityIndicator size="small" color="#0363a9" />
                      </View>
                    )}
                  </View>

                  {/* Search results list */}
                  {searchResults.length > 0 && (
                    <ScrollView style={s.resultsList} keyboardShouldPersistTaps="handled">
                      {searchResults.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          onPress={() => navigateToEquipment(item.id, item.internal_code ?? item.name)}
                          style={s.resultItem}
                        >
                          <View style={s.resultIcon}>
                            <Ionicons name="cube-outline" size={16} color="#0363a9" />
                          </View>
                          <View style={s.resultMeta}>
                            <Text style={s.resultName} numberOfLines={1}>{item.name}</Text>
                            {item.internal_code && (
                              <Text style={s.resultCode}>{item.internal_code}</Text>
                            )}
                          </View>
                          <Ionicons name="chevron-forward" size={14} color="#64748B" />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}

                  {searchError && manualCode.trim().length > 0 && !searching && (
                    <Text style={s.searchError}>{searchError}</Text>
                  )}

                  {recentScans.length > 0 && searchResults.length === 0 && !manualCode.trim() && (
                    <>
                      <Text style={s.recentLabel}>Recentes</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.recentScroll}>
                        {recentScans.map((scan) => (
                          <TouchableOpacity
                            key={scan.id}
                            onPress={() => navigateToEquipment(scan.id, scan.label)}
                            style={s.recentChip}
                          >
                            <Ionicons name="time-outline" size={12} color="#7dd3fc" />
                            <Text style={s.recentChipText}>{scan.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </>
                  )}

                  <TouchableOpacity
                    onPress={() => { setShowManualInput(false); setScanned(false); setManualCode(""); setSearchError(null); setSearchResults([]); }}
                    style={s.scanAgainBtn}
                  >
                    <Ionicons name="camera-outline" size={16} color="#0363a9" />
                    <Text style={s.scanAgainText}>Escanear Novamente</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={s.instructionText}>
                  Aponte a câmera para o QR Code colado no equipamento
                </Text>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </CameraView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F0F10", padding: 24 },
  permissionText: { color: "#94A3B8", fontSize: 14, marginTop: 12 },
  errorText: { color: "#EF4444", fontSize: 15, fontWeight: "500", marginTop: 16, textAlign: "center" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "space-between" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, backgroundColor: "rgba(3,99,169,0.85)" },
  iconBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center", borderRadius: 20, backgroundColor: "rgba(0,0,0,0.3)" },
  headerTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  maskContainer: { flex: 1, flexDirection: "row" },
  maskSide: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  maskCenter: { width: 250, justifyContent: "center", alignItems: "center" },
  scanFrame: { width: 240, height: 240, position: "relative", justifyContent: "center", alignItems: "center" },
  corner: { position: "absolute", width: 28, height: 28, borderColor: "#0363a9" },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  resolvingLoader: { backgroundColor: "rgba(15,15,16,0.9)", borderRadius: 8, padding: 16, alignItems: "center" },
  resolvingText: { color: "#7dd3fc", fontSize: 12, fontWeight: "600", marginTop: 8 },
  footer: { maxHeight: 380, padding: 20, paddingBottom: 32, backgroundColor: "rgba(15,15,16,0.9)" },
  instructionText: { color: "#E2E8F0", fontSize: 13, fontWeight: "500", textAlign: "center" },
  manualTitle: { color: "#94A3B8", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  manualInput: { flex: 1, backgroundColor: "#1C1D20", borderWidth: 1, borderColor: "#2E3033", borderRadius: 8, paddingHorizontal: 14, height: 44, color: "#F8FAFC", fontSize: 14 },
  searchIndicator: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  resultsList: { maxHeight: 180, marginBottom: 6 },
  resultItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: "#1C1D20", borderRadius: 8, marginBottom: 4 },
  resultIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: "#0a2540", justifyContent: "center", alignItems: "center" },
  resultMeta: { flex: 1 },
  resultName: { color: "#F8FAFC", fontSize: 13, fontWeight: "600" },
  resultCode: { color: "#64748B", fontSize: 11, marginTop: 1 },
  searchError: { color: "#EF4444", fontSize: 12, marginBottom: 8 },
  recentLabel: { color: "#64748B", fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 10, marginBottom: 6 },
  recentScroll: { marginBottom: 10 },
  recentChip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#0a2540", borderWidth: 1, borderColor: "#1a4a7a", borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, marginRight: 8 },
  recentChipText: { color: "#7dd3fc", fontSize: 12, fontWeight: "600" },
  scanAgainBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, marginTop: 4 },
  scanAgainText: { color: "#0363a9", fontSize: 13, fontWeight: "600" },
});
