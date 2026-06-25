import { apiFetch } from "./client";
import { User, Permission } from "../types/api";

export interface UserFilters {
  role?: string;
  company_id?: string;
}

export const usersApi = {
  async list(filters: UserFilters = {}): Promise<User[]> {
    const params = new URLSearchParams();
    if (filters.role) params.append("role", filters.role);
    if (filters.company_id) params.append("company_id", filters.company_id);
    const queryString = params.toString();
    const { data } = await apiFetch<{ data: User[] }>(`/api/users${queryString ? `?${queryString}` : ""}`);
    return data;
  },

  async uploadAvatar(uri: string, name: string, type: string): Promise<{ url: string; path: string }> {
    const formData = new FormData();
    // @ts-ignore
    formData.append("file", {
      uri,
      name,
      type,
    });

    return apiFetch<{ url: string; path: string }>("/api/users/avatar", {
      method: "POST",
      body: formData,
    });
  },

  async invite(email: string, name: string, role: string, companyId?: string): Promise<{ ok: boolean }> {
    return apiFetch<{ ok: boolean }>("/api/invitations", {
      method: "POST",
      body: { email, name, role, company_id: companyId },
    });
  },

  async update(id: string, data: Partial<User>): Promise<{ data: User }> {
    return apiFetch<{ data: User }>(`/api/users/${id}`, {
      method: "PATCH",
      body: data,
    });
  },

  async getById(id: string): Promise<{ data: User }> {
    return apiFetch<{ data: User }>(`/api/users/${id}`);
  },

  async deactivate(id: string, isActive: boolean): Promise<{ data: User }> {
    return apiFetch<{ data: User }>(`/api/users/${id}/deactivate`, {
      method: "PATCH",
      body: { is_active: isActive },
    });
  },

  async getPermissions(id: string): Promise<{ data: Permission[] }> {
    return apiFetch<{ data: Permission[] }>(`/api/users/${id}/permissions`);
  },

  async updatePermissions(id: string, permissions: Permission[]): Promise<{ data: Permission[] }> {
    return apiFetch<{ data: Permission[] }>(`/api/users/${id}/permissions`, {
      method: "PUT",
      body: { permissions },
    });
  },
};
