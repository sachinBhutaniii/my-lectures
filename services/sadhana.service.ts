import apiClient from "@/lib/axios";

export interface SadhanaOption {
  value: string;
  label: string;
  points: number;
}

export interface SadhanaQuestion {
  id: number;
  slug: string;
  title: string;
  description?: string;
  category?: string;
  displayOrder: number;
  active: boolean;
  hidden: boolean;
  options: SadhanaOption[];
}

export interface SadhanaEntryResponse {
  id: number;
  entryDate: string;
  totalScore: number;
  maxScore: number;
  answers: Record<string, string>;
  submittedAt: string;
}

export const getSadhanaQuestions = async (): Promise<SadhanaQuestion[]> => {
  const res = await apiClient.get<SadhanaQuestion[]>("/api/sadhana/questions");
  return res.data;
};

export const getTodayEntry = async (): Promise<SadhanaEntryResponse | null> => {
  try {
    const res = await apiClient.get<SadhanaEntryResponse>("/api/sadhana/entries/today");
    return res.data;
  } catch (e: any) {
    if (e?.response?.status === 204 || e?.response?.status === 404) return null;
    throw e;
  }
};

export const getMyEntries = async (): Promise<SadhanaEntryResponse[]> => {
  const res = await apiClient.get<SadhanaEntryResponse[]>("/api/sadhana/entries");
  return res.data;
};

export const submitSadhanaEntry = async (
  date: string,
  answers: Record<string, string>
): Promise<SadhanaEntryResponse> => {
  const res = await apiClient.post<SadhanaEntryResponse>("/api/sadhana/entries", { date, answers });
  return res.data;
};

// ── Admin ──────────────────────────────────────────────────────────────────

export const adminGetQuestions = async (): Promise<SadhanaQuestion[]> => {
  const res = await apiClient.get<SadhanaQuestion[]>("/api/sadhana/admin/questions");
  return res.data;
};

export const adminCreateQuestion = async (q: Omit<SadhanaQuestion, "id">): Promise<SadhanaQuestion> => {
  const res = await apiClient.post<SadhanaQuestion>("/api/sadhana/admin/questions", q);
  return res.data;
};

export const adminUpdateQuestion = async (id: number, q: Partial<SadhanaQuestion>): Promise<SadhanaQuestion> => {
  const res = await apiClient.put<SadhanaQuestion>(`/api/sadhana/admin/questions/${id}`, q);
  return res.data;
};

export const adminDeleteQuestion = async (id: number): Promise<void> => {
  await apiClient.delete(`/api/sadhana/admin/questions/${id}`);
};

export const adminReorderQuestions = async (items: { id: number; displayOrder: number }[]): Promise<void> => {
  await apiClient.put("/api/sadhana/admin/questions/reorder", items);
};
