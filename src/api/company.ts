import { apiFetch } from "./client";

export interface Company {
  id: string;
  name: string;
  cnpj: string | null;
  slug: string;
  primary_color: string | null;
  logo_url: string | null;
  created_at: string;
}

export const companyApi = {
  async listAll(): Promise<{ data: Company[] }> {
    return apiFetch<{ data: Company[] }>("/api/companies");
  },

  async get(id: string): Promise<{ data: Company }> {
    return apiFetch<{ data: Company }>(`/api/companies/${id}`);
  },

  async update(id: string, data: { name?: string; cnpj?: string | null }): Promise<{ data: Company }> {
    return apiFetch<{ data: Company }>(`/api/companies/${id}`, {
      method: "PATCH",
      body: data,
    });
  },
};
