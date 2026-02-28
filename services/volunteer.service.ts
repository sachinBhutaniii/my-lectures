import apiClient from "@/lib/axios";

export interface VolunteerServiceItem {
  id: number;
  name: string;
  description: string;
  slug: string;
  active: boolean;
  sortOrder: number;
}

export interface VolunteerRequestItem {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  userAvatarUrl?: string | null;
  serviceId: number;
  serviceName: string;
  serviceSlug: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  languages: string | null;
  adminMessage: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  canReapplyAt: string | null;
}

// ── Active services (public / user-facing) ─────────────────────────────────

export const getVolunteerServices = async (): Promise<VolunteerServiceItem[]> => {
  const res = await apiClient.get<VolunteerServiceItem[]>("/api/volunteer/services");
  return res.data;
};

// ── All services including inactive (admin only) ───────────────────────────

export const getAllVolunteerServices = async (): Promise<VolunteerServiceItem[]> => {
  const res = await apiClient.get<VolunteerServiceItem[]>("/api/volunteer/services/all");
  return res.data;
};

export const createVolunteerService = async (data: {
  name: string;
  description: string;
  slug: string;
  sortOrder?: number;
}): Promise<VolunteerServiceItem> => {
  const res = await apiClient.post<VolunteerServiceItem>("/api/volunteer/services", data);
  return res.data;
};

export const updateVolunteerService = async (
  id: number,
  data: Partial<{ name: string; description: string; slug: string; active: boolean; sortOrder: number }>
): Promise<VolunteerServiceItem> => {
  const res = await apiClient.put<VolunteerServiceItem>(`/api/volunteer/services/${id}`, data);
  return res.data;
};

export const deleteVolunteerService = async (id: number): Promise<void> => {
  await apiClient.delete(`/api/volunteer/services/${id}`);
};

// ── User request endpoints ─────────────────────────────────────────────────

export const submitVolunteerRequest = async (
  serviceId: number,
  languages?: string | null
): Promise<VolunteerRequestItem> => {
  const res = await apiClient.post<VolunteerRequestItem>("/api/volunteer/request", {
    serviceId,
    languages: languages || null,
  });
  return res.data;
};

export const getMyVolunteerRequests = async (): Promise<VolunteerRequestItem[]> => {
  const res = await apiClient.get<VolunteerRequestItem[]>("/api/volunteer/request/me");
  return res.data;
};

// ── Admin request endpoints ────────────────────────────────────────────────

export const getAllVolunteerRequests = async (): Promise<VolunteerRequestItem[]> => {
  const res = await apiClient.get<VolunteerRequestItem[]>("/api/volunteer/requests");
  return res.data;
};

export const approveVolunteerRequest = async (
  id: number,
  adminMessage?: string
): Promise<VolunteerRequestItem> => {
  const res = await apiClient.put<VolunteerRequestItem>(`/api/volunteer/requests/${id}/approve`, {
    adminMessage: adminMessage || "",
  });
  return res.data;
};

export const rejectVolunteerRequest = async (
  id: number,
  adminMessage: string
): Promise<VolunteerRequestItem> => {
  const res = await apiClient.put<VolunteerRequestItem>(`/api/volunteer/requests/${id}/reject`, {
    adminMessage,
  });
  return res.data;
};

// ── Cooldown config ────────────────────────────────────────────────────────

export const getVolunteerConfig = async (): Promise<{ rejectionCooldownDays: number }> => {
  const res = await apiClient.get<{ rejectionCooldownDays: number }>("/api/volunteer/config");
  return res.data;
};

export const updateVolunteerConfig = async (
  rejectionCooldownDays: number
): Promise<{ rejectionCooldownDays: number }> => {
  const res = await apiClient.put<{ rejectionCooldownDays: number }>("/api/volunteer/config", {
    rejectionCooldownDays,
  });
  return res.data;
};
