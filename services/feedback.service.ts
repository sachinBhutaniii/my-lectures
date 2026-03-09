import apiClient from "@/lib/axios";

export interface FeedbackCategory {
  id: number;
  name: string;
  createdAt: string;
}

export interface FeedbackItem {
  id: number;
  categoryId: number | null;
  categoryName: string | null;
  userId: number;
  userName: string;
  userEmail: string;
  message: string | null;
  audioUrl: string | null;
  screenshotUrl: string | null;
  createdAt: string;
  adminReply: string | null;
  repliedAt: string | null;
}

export const getCategories = async (): Promise<FeedbackCategory[]> => {
  const res = await apiClient.get<FeedbackCategory[]>("/api/feedback/categories");
  return res.data;
};

export const createCategory = async (name: string): Promise<FeedbackCategory> => {
  const res = await apiClient.post<FeedbackCategory>("/api/feedback/categories", { name });
  return res.data;
};

export const deleteCategory = async (id: number): Promise<void> => {
  await apiClient.delete(`/api/feedback/categories/${id}`);
};

export const submitFeedback = async (data: {
  categoryId?: number;
  message?: string;
  audioUrl?: string;
  screenshotUrl?: string;
}): Promise<FeedbackItem> => {
  const res = await apiClient.post<FeedbackItem>("/api/feedback", data);
  return res.data;
};

export const getFeedback = async (categoryId?: number): Promise<FeedbackItem[]> => {
  const url = categoryId ? `/api/feedback?categoryId=${categoryId}` : "/api/feedback";
  const res = await apiClient.get<FeedbackItem[]>(url);
  return res.data;
};

export const replyToFeedback = async (id: number, reply: string): Promise<FeedbackItem> => {
  const res = await apiClient.put<FeedbackItem>(`/api/feedback/${id}/reply`, { reply });
  return res.data;
};

export const uploadFile = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await apiClient.post<{ url: string }>("/api/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.url;
};
