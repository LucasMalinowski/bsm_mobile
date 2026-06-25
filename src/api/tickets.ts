import { apiFetch } from "./client";
import { Ticket, CreateTicketDTO, UpdateTicketDTO, TicketComment, PaginatedList } from "../types/api";

export interface TicketFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  priority?: string;
  assigned_to?: string;
  equipment_id?: string;
  sort?: string;
  order?: string;
  company_id?: string;
}

export const ticketsApi = {
  async list(filters: TicketFilters = {}): Promise<PaginatedList<Ticket>> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== "") {
        params.append(key, String(val));
      }
    });
    const queryString = params.toString();
    return apiFetch<PaginatedList<Ticket>>(`/api/tickets${queryString ? `?${queryString}` : ""}`);
  },

  async get(id: string): Promise<{ data: Ticket & { comments?: TicketComment[] } }> {
    return apiFetch<{ data: Ticket & { comments?: TicketComment[] } }>(`/api/tickets/${id}`);
  },

  async create(data: CreateTicketDTO): Promise<{ data: Ticket }> {
    return apiFetch<{ data: Ticket }>("/api/tickets", {
      method: "POST",
      body: data,
    });
  },

  async update(id: string, data: UpdateTicketDTO): Promise<{ data: Ticket }> {
    return apiFetch<{ data: Ticket }>(`/api/tickets/${id}`, {
      method: "PATCH",
      body: data,
    });
  },

  async delete(id: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/api/tickets/${id}`, {
      method: "DELETE",
    });
  },

  async addComment(ticketId: string, body: string): Promise<{ data: TicketComment }> {
    return apiFetch<{ data: TicketComment }>(`/api/tickets/${ticketId}/comments`, {
      method: "POST",
      body: { body },
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

    return apiFetch<{ url: string; path: string }>("/api/tickets/photo", {
      method: "POST",
      body: formData,
    });
  },
};
