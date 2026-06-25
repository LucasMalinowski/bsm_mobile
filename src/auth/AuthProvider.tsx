import React, { createContext, useContext, useState, useEffect } from "react";
import { AuthUser, AuthSession } from "../types/api";
import { tokenStorage } from "./tokenStorage";
import { authApi } from "../api/auth";

interface AuthContextType {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  activeCompanyId: string | null;
  setActiveCompanyId: (companyId: string | null) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: AuthUser) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCompanyId, setActiveCompanyIdState] = useState<string | null>(null);

  // Initialize session from secure store
  useEffect(() => {
    async function bootstrapAsync() {
      try {
        const stored = await tokenStorage.loadSession();
        if (stored.accessToken && stored.user) {
          setAccessToken(stored.accessToken);
          setUser(stored.user);
          setActiveCompanyIdState(await tokenStorage.loadActiveCompanyId());

          // Proactively validate stored token on backend
          try {
            const meRes = await authApi.me();
            if (meRes?.data?.user) {
              setUser(meRes.data.user);
            }
          } catch (meError: any) {
            // If token is invalid and cannot be refreshed, tokenStorage will clear and apiFetch will throw 401.
            // Let's verify if meError status is 401 or 403, and reset session in that case.
            if (meError.status === 401 || meError.status === 403) {
              await tokenStorage.clearSession();
              setAccessToken(null);
              setUser(null);
            }
          }
        }
      } catch (e) {
        console.error("Failed to load session on bootstrap", e);
      } finally {
        setIsLoading(false);
      }
    }

    bootstrapAsync();
  }, []);

  const setActiveCompanyId = async (companyId: string | null) => {
    if (companyId) {
      await tokenStorage.saveActiveCompanyId(companyId);
    } else {
      await tokenStorage.clearActiveCompanyId();
    }
    setActiveCompanyIdState(companyId);
  };

  const login = async (email: string, password: string) => {
    // isLoading is only for bootstrap — login loading is owned by the login screen.
    // Setting isLoading here unmounts the login screen while the request is in-flight,
    // causing any error state updates to be silently dropped by React.
    const res = await authApi.login(email, password);
    if (res.ok && res.data.session && res.data.user) {
      await tokenStorage.saveSession(res.data.session, res.data.user);
      setAccessToken(res.data.session.access_token);
      setUser(res.data.user);
    } else {
      throw new Error("Resposta de login inválida do servidor.");
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authApi.signout().catch(() => {});
    } finally {
      await tokenStorage.clearSession();
      setAccessToken(null);
      setUser(null);
      setActiveCompanyIdState(null);
      setIsLoading(false);
    }
  };

  const updateUser = async (updatedUser: AuthUser) => {
    setUser(updatedUser);
    const stored = await tokenStorage.loadSession();
    if (stored.accessToken && stored.refreshToken && stored.expiresAt) {
      const session: AuthSession = {
        access_token: stored.accessToken,
        refresh_token: stored.refreshToken,
        expires_at: stored.expiresAt,
        expires_in: 3600,
        token_type: "bearer",
      };
      await tokenStorage.saveSession(session, updatedUser);
    }
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, activeCompanyId, setActiveCompanyId, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
};
