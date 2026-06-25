import { apiFetch } from "./client";
import { CalibrationDocument, CalibrationPoint, CalibrationRecord, CreateCalibrationRecordDTO } from "../types/api";

export const calibrationApi = {
  async listTemplates(): Promise<{ data: CalibrationDocument[] }> {
    return apiFetch<{ data: CalibrationDocument[] }>("/api/calibration-documents");
  },

  async getPoints(equipmentId: string): Promise<{ data: CalibrationPoint[] }> {
    return apiFetch<{ data: CalibrationPoint[] }>(`/api/equipment/${equipmentId}/calibration-points`);
  },

  async setPoints(equipmentId: string, points: any[]): Promise<{ data: CalibrationPoint[] }> {
    return apiFetch<{ data: CalibrationPoint[] }>(`/api/equipment/${equipmentId}/calibration-points`, {
      method: "POST",
      body: points,
    });
  },

  async getRecords(equipmentId: string): Promise<{ data: CalibrationRecord[] }> {
    return apiFetch<{ data: CalibrationRecord[] }>(`/api/equipment/${equipmentId}/calibrations`);
  },

  async addRecord(equipmentId: string, data: CreateCalibrationRecordDTO): Promise<{ data: CalibrationRecord }> {
    return apiFetch<{ data: CalibrationRecord }>(`/api/equipment/${equipmentId}/calibrations`, {
      method: "POST",
      body: data,
    });
  },

  async uploadCertificate(equipmentId: string, recordId: string, uri: string, name: string, type: string): Promise<{ url: string; path: string }> {
    const formData = new FormData();
    // @ts-ignore
    formData.append("file", {
      uri,
      name,
      type,
    });

    return apiFetch<{ url: string; path: string }>(`/api/equipment/${equipmentId}/calibrations/${recordId}/certificate`, {
      method: "POST",
      body: formData,
    });
  },
};
