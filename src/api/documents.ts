import { apiFetch } from "./client";
import { Document, UpdateDocumentDTO, PaginatedList, DocumentVersion } from "../types/api";

export interface DocumentFilters {
  page?: number;
  limit?: number;
  search?: string;
  category_id?: string;
  equipment_id?: string;
  sort?: string;
  order?: string;
  company_id?: string;
}

export const documentsApi = {
  async list(filters: DocumentFilters = {}): Promise<PaginatedList<Document>> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== "") {
        params.append(key, String(val));
      }
    });
    const queryString = params.toString();
    return apiFetch<PaginatedList<Document>>(`/api/documents${queryString ? `?${queryString}` : ""}`);
  },

  async get(id: string): Promise<{ data: Document & { versions?: DocumentVersion[]; signed_url?: string } }> {
    return apiFetch<{ data: Document & { versions?: DocumentVersion[]; signed_url?: string } }>(`/api/documents/${id}`);
  },

  async update(id: string, data: UpdateDocumentDTO): Promise<{ data: Document }> {
    return apiFetch<{ data: Document }>(`/api/documents/${id}`, {
      method: "PATCH",
      body: data,
    });
  },

  async delete(id: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/api/documents/${id}`, {
      method: "DELETE",
    });
  },

  async getDownloadUrl(id: string): Promise<{ url: string } | string> {
    return apiFetch<any>(`/api/documents/${id}/download`);
  },

  async uploadVersion(id: string, uri: string, name: string, type: string, notes?: string): Promise<{ data: DocumentVersion }> {
    const formData = new FormData();
    // @ts-ignore
    formData.append("file", { uri, name, type });
    if (notes) formData.append("notes", notes);
    return apiFetch<{ data: DocumentVersion }>(`/api/documents/${id}/versions`, {
      method: "POST",
      body: formData,
    });
  },
};
