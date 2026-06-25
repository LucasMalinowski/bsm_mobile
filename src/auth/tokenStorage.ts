import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { AuthUser, AuthSession } from "../types/api";

const KEY_ACCESS_TOKEN = "bsm_access_token";
const KEY_REFRESH_TOKEN = "bsm_refresh_token";
const KEY_EXPIRES_AT = "bsm_expires_at";
const KEY_USER = "bsm_user";
const KEY_ACTIVE_COMPANY_ID = "bsm_active_company_id";

// Helper checking if SecureStore is supported
const isSecureStoreAvailable = async (): Promise<boolean> => {
  if (Platform.OS === "web") return false;
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
};

export interface StoredAuth {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  user: AuthUser | null;
}

export const tokenStorage = {
  async saveSession(session: AuthSession, user: AuthUser): Promise<void> {
    const expiresAtStr = String(session.expires_at);
    const userStr = JSON.stringify(user);

    if (await isSecureStoreAvailable()) {
      await SecureStore.setItemAsync(KEY_ACCESS_TOKEN, session.access_token);
      await SecureStore.setItemAsync(KEY_REFRESH_TOKEN, session.refresh_token);
      await SecureStore.setItemAsync(KEY_EXPIRES_AT, expiresAtStr);
      await SecureStore.setItemAsync(KEY_USER, userStr);
    } else {
      // Web / Fallback
      if (Platform.OS === "web") {
        localStorage.setItem(KEY_ACCESS_TOKEN, session.access_token);
        localStorage.setItem(KEY_REFRESH_TOKEN, session.refresh_token);
        localStorage.setItem(KEY_EXPIRES_AT, expiresAtStr);
        localStorage.setItem(KEY_USER, userStr);
      }
    }
  },

  async loadSession(): Promise<StoredAuth> {
    try {
      let accessToken: string | null = null;
      let refreshToken: string | null = null;
      let expiresAtStr: string | null = null;
      let userStr: string | null = null;

      if (await isSecureStoreAvailable()) {
        accessToken = await SecureStore.getItemAsync(KEY_ACCESS_TOKEN);
        refreshToken = await SecureStore.getItemAsync(KEY_REFRESH_TOKEN);
        expiresAtStr = await SecureStore.getItemAsync(KEY_EXPIRES_AT);
        userStr = await SecureStore.getItemAsync(KEY_USER);
      } else {
        if (Platform.OS === "web") {
          accessToken = localStorage.getItem(KEY_ACCESS_TOKEN);
          refreshToken = localStorage.getItem(KEY_REFRESH_TOKEN);
          expiresAtStr = localStorage.getItem(KEY_EXPIRES_AT);
          userStr = localStorage.getItem(KEY_USER);
        }
      }

      const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : null;
      const user = userStr ? (JSON.parse(userStr) as AuthUser) : null;

      return {
        accessToken,
        refreshToken,
        expiresAt,
        user,
      };
    } catch (e) {
      console.error("Error loading session", e);
      return { accessToken: null, refreshToken: null, expiresAt: null, user: null };
    }
  },

  async clearSession(): Promise<void> {
    if (await isSecureStoreAvailable()) {
      await SecureStore.deleteItemAsync(KEY_ACCESS_TOKEN);
      await SecureStore.deleteItemAsync(KEY_REFRESH_TOKEN);
      await SecureStore.deleteItemAsync(KEY_EXPIRES_AT);
      await SecureStore.deleteItemAsync(KEY_USER);
    } else {
      if (Platform.OS === "web") {
        localStorage.removeItem(KEY_ACCESS_TOKEN);
        localStorage.removeItem(KEY_REFRESH_TOKEN);
        localStorage.removeItem(KEY_EXPIRES_AT);
        localStorage.removeItem(KEY_USER);
      }
    }
    await tokenStorage.clearActiveCompanyId();
  },

  // Active company — only meaningful for super_admin, who has no company_id of
  // their own. Mobile is Bearer-token only (no cookies), so it can't reuse web's
  // impersonation cookie; this is the mobile-native equivalent: an explicit
  // company_id attached to requests instead of session-derived state.
  async saveActiveCompanyId(companyId: string): Promise<void> {
    if (await isSecureStoreAvailable()) {
      await SecureStore.setItemAsync(KEY_ACTIVE_COMPANY_ID, companyId);
    } else if (Platform.OS === "web") {
      localStorage.setItem(KEY_ACTIVE_COMPANY_ID, companyId);
    }
  },

  async loadActiveCompanyId(): Promise<string | null> {
    if (await isSecureStoreAvailable()) {
      return await SecureStore.getItemAsync(KEY_ACTIVE_COMPANY_ID);
    } else if (Platform.OS === "web") {
      return localStorage.getItem(KEY_ACTIVE_COMPANY_ID);
    }
    return null;
  },

  async clearActiveCompanyId(): Promise<void> {
    if (await isSecureStoreAvailable()) {
      await SecureStore.deleteItemAsync(KEY_ACTIVE_COMPANY_ID);
    } else if (Platform.OS === "web") {
      localStorage.removeItem(KEY_ACTIVE_COMPANY_ID);
    }
  },
};
