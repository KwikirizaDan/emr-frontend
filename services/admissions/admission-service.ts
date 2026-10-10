/**
 * Ward and admissions service.
 */

import { getList, getOne } from "@/services/http/list-helpers";
import { bffRequest } from "@/services/http/bff-client";
import type {
  Admission,
  AdmissionDetail,
  Paginated,
  WardWithBeds,
} from "@/services/http/api-types";

export type AdmissionFilters = {
  status?: "ADMITTED" | "DISCHARGED";
  patient_id?: number;
  ward_id?: number;
  page?: number;
  per_page?: number;
};

export type AdmissionPayload = {
  patient_id: number;
  encounter_id: number;
  bed_id: number;
  admitting_doctor_id?: number | null;
  reason: string;
};

export type DischargePayload = {
  condition_at_discharge:
    | "RECOVERED"
    | "IMPROVED"
    | "UNCHANGED"
    | "TRANSFERRED"
    | "LEFT_AGAINST_ADVICE"
    | "DECEASED";
  summary: string;
  instructions?: string | null;
};

export const wardService = {
  list(): Promise<WardWithBeds[]> {
    return bffRequest<WardWithBeds[]>("/wards").then((response) => {
      const data = (response as { data?: WardWithBeds[] }).data;
      return Array.isArray(data) ? data : [];
    });
  },

  create(payload: { code: string; name: string }): Promise<WardWithBeds> {
    return bffRequest<WardWithBeds>("/wards", { method: "POST", body: payload });
  },

  addBed(wardId: string | number, bed_number: string): Promise<unknown> {
    return bffRequest(`/wards/${wardId}/beds`, {
      method: "POST",
      body: { bed_number },
    });
  },
};

export const admissionService = {
  list(filters: AdmissionFilters = {}): Promise<Paginated<AdmissionDetail>> {
    return getList<AdmissionDetail>("/admissions", { ...filters });
  },

  getById(admissionId: string | number): Promise<AdmissionDetail | null> {
    return getOne<AdmissionDetail>(`/admissions/${admissionId}`);
  },

  create(payload: AdmissionPayload): Promise<Admission> {
    return bffRequest<Admission>("/admissions", {
      method: "POST",
      body: payload,
    });
  },

  discharge(admissionId: string | number, payload: DischargePayload): Promise<Admission> {
    return bffRequest<Admission>(`/admissions/${admissionId}/discharge`, {
      method: "POST",
      body: payload,
    });
  },
};