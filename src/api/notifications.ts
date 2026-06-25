import { apiFetch } from "./client";
import { Notification } from "../types/api";

export const notificationsApi = {
  async list(unreadOnly = false): Promise<{ data: Notification[] }> {
    return apiFetch<{ data: Notification[] }>(`/api/notifications?unread=${unreadOnly}`);
  },

  async markRead(id: string): Promise<{ ok: boolean }> {
    return apiFetch<{ ok: boolean }>(`/api/notifications/${id}/read`, {
      method: "POST",
    });
  },

  async markAllRead(): Promise<{ ok: boolean }> {
    return apiFetch<{ ok: boolean }>("/api/notifications/read-all", {
      method: "POST",
    });
  },

  async getPreferences(): Promise<{ data: { cal_alert: boolean; unassigned: boolean; weekly: boolean } }> {
    return apiFetch("/api/notifications/preferences");
  },

  async updatePreferences(prefs: { cal_alert?: boolean; unassigned?: boolean; weekly?: boolean }): Promise<{ data: unknown }> {
    return apiFetch("/api/notifications/preferences", {
      method: "PATCH",
      body: prefs,
    });
  },
};
