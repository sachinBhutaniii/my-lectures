import apiClient from "@/lib/axios";
import { ShlokaData } from "@/types/shloka";

export async function getShlokaData(videoId: number, locale: string): Promise<ShlokaData | null> {
  try {
    const res = await apiClient.get<ShlokaData>(`/api/shlokas/${videoId}?locale=${locale}`);
    return res.data;
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number } };
    if (axiosErr?.response?.status === 404) return null;
    throw err;
  }
}

export async function generateShlokaData(videoId: number): Promise<{ generated: string[] }> {
  const res = await apiClient.post<{ generated: string[] }>(`/api/shlokas/generate/${videoId}`);
  return res.data;
}

export async function generateAllShlokaData(): Promise<{ status: string }> {
  const res = await apiClient.post<{ status: string }>("/api/shlokas/generate-all");
  return res.data;
}
