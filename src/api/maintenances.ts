import { apiFetch } from "./client";
import { MaintenanceRecord, CreateMaintenanceRecordDTO } from "../types/api";

export const maintenanceApi = {
  async list(equipmentId: string): Promise<{ data: MaintenanceRecord[] }> {
    return apiFetch<{ data: MaintenanceRecord[] }>(`/api/equipment/${equipmentId}/maintenances`);
  },

  async create(equipmentId: string, data: CreateMaintenanceRecordDTO): Promise<{ data: MaintenanceRecord }> {
    return apiFetch<{ data: MaintenanceRecord }>(`/api/equipment/${equipmentId}/maintenances`, {
      method: "POST",
      body: data as unknown as Record<string, unknown>,
    });
  },
};
