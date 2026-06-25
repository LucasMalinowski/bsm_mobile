import { apiFetch } from "./client";
import { LoginResponse, MeResponse } from "../types/api";

export const authApi = {
  async login(email: string, password: string): Promise<LoginResponse> {
    return apiFetch<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
  },

  async me(): Promise<MeResponse> {
    return apiFetch<MeResponse>("/api/auth/me");
  },

  async signout(): Promise<{ ok: boolean }> {
    return apiFetch<{ ok: boolean }>("/api/auth/signout", {
      method: "POST",
    });
  },

  async resetPassword(email: string): Promise<{ ok: boolean }> {
    return apiFetch<{ ok: boolean }>("/api/auth/reset-password", {
      method: "POST",
      body: { email },
    });
  },
};
