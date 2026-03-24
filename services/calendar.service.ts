import apiClient from "@/lib/axios";
import type { VaishnavaEvent, VaishnavaEventRequest } from "@/types/calendar";

export async function getCalendarEvents(year: number, month: number): Promise<VaishnavaEvent[]> {
  const res = await apiClient.get<VaishnavaEvent[]>("/api/calendar/events", {
    params: { year, month },
  });
  return res.data;
}

export async function createCalendarEvent(data: VaishnavaEventRequest): Promise<VaishnavaEvent> {
  const res = await apiClient.post<VaishnavaEvent>("/api/calendar/events", data);
  return res.data;
}

export async function updateCalendarEvent(id: number, data: VaishnavaEventRequest): Promise<VaishnavaEvent> {
  const res = await apiClient.put<VaishnavaEvent>(`/api/calendar/events/${id}`, data);
  return res.data;
}

export async function deleteCalendarEvent(id: number): Promise<void> {
  await apiClient.delete(`/api/calendar/events/${id}`);
}

export async function importIcalEvents(file: File): Promise<{ imported: number }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await apiClient.post<{ imported: number }>("/api/calendar/events/import-ical", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}
