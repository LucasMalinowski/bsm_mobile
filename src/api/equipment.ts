import { apiFetch } from "./client";
import { Equipment, CreateEquipmentDTO, UpdateEquipmentDTO, PaginatedList, EquipmentHistory } from "../types/api";

export interface EquipmentFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  category_id?: string;
  sort?: string;
  order?: string;
  company_id?: string;
}

export const equipmentApi = {
  async list(filters: EquipmentFilters = {}): Promise<PaginatedList<Equipment>> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== "") {
        params.append(key, String(val));
      }
    });
    const queryString = params.toString();
    return apiFetch<PaginatedList<Equipment>>(`/api/equipment${queryString ? `?${queryString}` : ""}`);
  },

  async get(id: string): Promise<{ data: Equipment & { history?: EquipmentHistory[] } }> {
    return apiFetch<{ data: Equipment & { history?: EquipmentHistory[] } }>(`/api/equipment/${id}`);
  },

  async create(data: CreateEquipmentDTO): Promise<{ data: Equipment }> {
    return apiFetch<{ data: Equipment }>("/api/equipment", {
      method: "POST",
      body: data,
    });
  },

  async update(id: string, data: UpdateEquipmentDTO): Promise<{ data: Equipment }> {
    return apiFetch<{ data: Equipment }>(`/api/equipment/${id}`, {
      method: "PATCH",
      body: data,
    });
  },

  async delete(id: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/api/equipment/${id}`, {
      method: "DELETE",
    });
  },

  async uploadPhoto(uri: string, name: string, type: string): Promise<{ url: string; path: string }> {
    const formData = new FormData();
    // @ts-ignore
    formData.append("file", {
      uri,
      name,
      type,
    });

    return apiFetch<{ url: string; path: string }>("/api/equipment/photo", {
      method: "POST",
      body: formData,
    });
  },

  async getDocsByModel(model: string): Promise<{ data: any[] }> {
    return apiFetch<{ data: any[] }>(`/api/equipment/docs-by-model?model=${encodeURIComponent(model)}`);
  },

  async getQrToken(token: string): Promise<any> {
    return apiFetch<any>(`/api/equipment/qr/${token}`);
  }
};
