import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from "react-native";
import { Camera, CameraView } from "expo-camera";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { equipmentApi } from "../../../api/equipment";

const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const RECENT_KEY = "bsm_recent_scans";
const MAX_RECENT = 10;

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

export default function QRScannerScreen() {
  const router = useRouter();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);

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
      router.replace(`/(app)/equipment/${id}`);
    },
    [router]
  );

  const handleBarCodeScanned = async ({ data }: { type: string; data: string }) => {
    if (scanned || resolving) return;
    setScanned(true);

    const match = data.match(UUID_REGEX);
    if (match) {
      navigateToEquipment(match[0]);
      return;
    }

    if (data.includes("/equipment/qr/") || data.includes("/api/equipment/qr/")) {
      setResolving(true);
      try {
        const res = await fetch(data, { method: "GET" });
        const finalMatch = res.url.match(UUID_REGEX);
        if (finalMatch) {
          navigateToEquipment(finalMatch[0]);
          return;
        }
      } catch {
        // fall through to manual input
      } finally {
        setResolving(false);
      }
    }

    // QR unrecognised — show manual input instead of an Alert
    setShowManualInput(true);
  };

  const handleManualSearch = async () => {
    const trimmed = manualCode.trim();
    if (!trimmed) return;
    setSearchError(null);
    setSearching(true);
    try {
      // Direct UUID → navigate immediately
      if (UUID_REGEX.test(trimmed)) {
        await navigateToEquipment(trimmed);
        return;
      }
      // Fallback: search by internal code or name
      const res = await equipmentApi.list({ search: trimmed, limit: 1 });
      const found = res.data?.[0];
      if (found) {
        await navigateToEquipment(found.id, found.internal_code);
      } else {
        setSearchError("Equipamento não encontrado. Verifique o código e tente novamente.");
      }
    } catch (e: any) {
      setSearchError(e.message || "Erro ao buscar equipamento.");
    } finally {
      setSearching(false);
    }
  };

  if (hasPermission === null) {
    return (
      <View style={s.centerContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={s.permissionText}>Solicitando permissão da câmera...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={s.centerContainer}>
        <Ionicons name="camera-reverse-outline" size={48} color="#EF4444" />
        <Text style={s.errorText}>Acesso à câmera foi negado nas configurações.</Text>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backBtnText}>Voltar</Text>
        </TouchableOpacity>
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
          <View style={s.header}>
            <TouchableOpacity onPress={() => router.back()} style={s.closeBtn}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Leitor QR Code</Text>
            <TouchableOpacity
              onPress={() => { setShowManualInput((v) => !v); setScanned(true); }}
              style={s.closeBtn}
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
                    <ActivityIndicator size="small" color="#6366F1" />
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
                      onChangeText={(t) => { setManualCode(t); setSearchError(null); }}
                      placeholder="Código interno ou UUID do equipamento"
                      placeholderTextColor="#64748B"
                      style={s.manualInput}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="search"
                      onSubmitEditing={handleManualSearch}
                    />
                    <TouchableOpacity
                      onPress={handleManualSearch}
                      disabled={searching || !manualCode.trim()}
                      style={[s.searchBtn, (!manualCode.trim() || searching) && s.searchBtnDisabled]}
                    >
                      {searching
                        ? <ActivityIndicator size="small" color="#FFFFFF" />
                        : <Ionicons name="search" size={20} color="#FFFFFF" />
                      }
                    </TouchableOpacity>
                  </View>
                  {searchError && <Text style={s.searchError}>{searchError}</Text>}

                  {recentScans.length > 0 && (
                    <>
                      <Text style={s.recentLabel}>Recentes</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.recentScroll}>
                        {recentScans.map((scan) => (
                          <TouchableOpacity
                            key={scan.id}
                            onPress={() => navigateToEquipment(scan.id, scan.label)}
                            style={s.recentChip}
                          >
                            <Ionicons name="time-outline" size={12} color="#818CF8" />
                            <Text style={s.recentChipText}>{scan.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </>
                  )}

                  <TouchableOpacity
                    onPress={() => { setShowManualInput(false); setScanned(false); setManualCode(""); setSearchError(null); }}
                    style={s.scanAgainBtn}
                  >
                    <Ionicons name="camera-outline" size={16} color="#6366F1" />
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
  errorText: { color: "#EF4444", fontSize: 15, fontWeight: "500", marginTop: 16, textAlign: "center", marginBottom: 20 },
  backBtn: { backgroundColor: "#6366F1", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  backBtnText: { color: "#FFFFFF", fontWeight: "600" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "space-between" },
  header: { height: 72, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16, backgroundColor: "rgba(15,15,16,0.8)" },
  closeBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center", borderRadius: 20, backgroundColor: "rgba(0,0,0,0.5)" },
  headerTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  maskContainer: { flex: 1, flexDirection: "row" },
  maskSide: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  maskCenter: { width: 250, justifyContent: "center", alignItems: "center" },
  scanFrame: { width: 240, height: 240, position: "relative", justifyContent: "center", alignItems: "center" },
  corner: { position: "absolute", width: 24, height: 24, borderColor: "#6366F1" },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  resolvingLoader: { backgroundColor: "rgba(15,15,16,0.9)", borderRadius: 8, padding: 16, alignItems: "center" },
  resolvingText: { color: "#6366F1", fontSize: 12, fontWeight: "600", marginTop: 8 },
  footer: { padding: 20, paddingBottom: 32, backgroundColor: "rgba(15,15,16,0.9)" },
  instructionText: { color: "#E2E8F0", fontSize: 13, fontWeight: "500", textAlign: "center" },
  manualTitle: { color: "#94A3B8", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  inputRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
  manualInput: { flex: 1, backgroundColor: "#1C1D20", borderWidth: 1, borderColor: "#2E3033", borderRadius: 8, paddingHorizontal: 14, height: 44, color: "#F8FAFC", fontSize: 14 },
  searchBtn: { width: 44, height: 44, backgroundColor: "#6366F1", borderRadius: 8, justifyContent: "center", alignItems: "center" },
  searchBtnDisabled: { opacity: 0.5 },
  searchError: { color: "#EF4444", fontSize: 12, marginBottom: 8 },
  recentLabel: { color: "#64748B", fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 10, marginBottom: 6 },
  recentScroll: { marginBottom: 10 },
  recentChip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#1A1A2E", borderWidth: 1, borderColor: "#312E81", borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, marginRight: 8 },
  recentChipText: { color: "#818CF8", fontSize: 12, fontWeight: "600" },
  scanAgainBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, marginTop: 4 },
  scanAgainText: { color: "#6366F1", fontSize: 13, fontWeight: "600" },
});
