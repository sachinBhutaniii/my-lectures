import apiClient from "@/lib/axios";
import { VideoApiResponse, VideoDetailResponse, LectureVideo, LanguageData } from '@/types/videos'; 
//Start from the src folder, then go to: 
// instead of this import , import { Video } from "../../../types/video";

const VIDEO_API_URL = "/videos";
const VIDEO_DETAIL_API = "/video-detail";
const LANGUAGE_API_URL = "/locales";

export const getVideos = async (): Promise<VideoApiResponse> => {
  const response = await apiClient.get<VideoApiResponse>(VIDEO_API_URL);
  return response.data;
};

export const getVideoById = async (
  id: number | string,
  languageCode?: string
): Promise<LectureVideo> => {
  const response = await apiClient.get<LectureVideo>(
    `/videos/${id}?locale=${languageCode || 'en'}`
  );
  return response.data;
};

export const createVideo = async (video: Omit<LectureVideo, 'id'>): Promise<LectureVideo> => {
  const response = await apiClient.post<LectureVideo>(VIDEO_API_URL, video);
  return response.data;
};

export const updateVideo = async (id: number, video: Omit<LectureVideo, 'id'>): Promise<LectureVideo> => {
  const response = await apiClient.put<LectureVideo>(`${VIDEO_API_URL}/${id}`, video);
  return response.data;
};

export const deleteVideo = async (id: number): Promise<void> => {
  await apiClient.delete(`${VIDEO_API_URL}/${id}`);
};


export const getLanguageData = async (): Promise<LanguageData[]> => {
  const response = await apiClient.get<LanguageData[]>(LANGUAGE_API_URL);
  return response.data;
};

// ── User management ──────────────────────────────────────────────────────────

export interface LocaleInfo {
  id: number;
  code: string;
  name: string;
}

export interface UserSearchResult {
  id: number;
  email: string;
  name: string;
  avatarUrl?: string;
  role: string;
  locales?: LocaleInfo[];
}

export const searchUsers = async (q?: string): Promise<UserSearchResult[]> => {
  const params = q ? `?q=${encodeURIComponent(q)}` : "";
  const res = await apiClient.get<UserSearchResult[]>(`/api/users/search${params}`);
  return res.data;
};

export const updateUserRole = async (userId: number, role: string): Promise<UserSearchResult> => {
  const res = await apiClient.put<UserSearchResult>(`/api/users/${userId}/role`, { role });
  return res.data;
};

// ── Transcript review ─────────────────────────────────────────────────────────

export interface TranscriptReviewItem {
  id: number;
  videoId: number;
  videoTitle: string;
  videoThumbnailUrl: string;
  localeCode: string;
  localeName: string;
  transcriptPreview: string;
  approvalStatus: string;
  level1ApprovedByName: string | null;
  finalApprovedByName: string | null;
  level1ProofreaderId: number | null;
  level1ProofreaderName: string | null;
  level2ProofreaderId: number | null;
  level2ProofreaderName: string | null;
  deployed: boolean;
  l1ReviewSubmitted: boolean;
  l2ReviewSubmitted: boolean;
  audioUrl?: string;
}

export const addLocaleToVideo = async (videoId: number, localeId: number): Promise<TranscriptReviewItem> => {
  const res = await apiClient.post<TranscriptReviewItem>("/api/transcripts/add-locale", { videoId, localeId });
  return res.data;
};

export const getAllTranscripts = async (): Promise<TranscriptReviewItem[]> => {
  const res = await apiClient.get<TranscriptReviewItem[]>("/api/transcripts/all");
  return res.data;
};

export const getTranscriptsForReview = async (): Promise<TranscriptReviewItem[]> => {
  const res = await apiClient.get<TranscriptReviewItem[]>("/api/transcripts/review");
  return res.data;
};

export const approveTranscript = async (id: number): Promise<TranscriptReviewItem> => {
  const res = await apiClient.put<TranscriptReviewItem>(`/api/transcripts/${id}/approve`);
  return res.data;
};

export const rejectTranscript = async (id: number): Promise<TranscriptReviewItem> => {
  const res = await apiClient.put<TranscriptReviewItem>(`/api/transcripts/${id}/reject`);
  return res.data;
};

export const assignProofreader = async (
  transcriptId: number,
  userId: number | null,
  level: 1 | 2
): Promise<TranscriptReviewItem> => {
  const res = await apiClient.put<TranscriptReviewItem>(`/api/transcripts/${transcriptId}/assign`, { userId, level });
  return res.data;
};

export const deployTranscript = async (id: number): Promise<TranscriptReviewItem> => {
  const res = await apiClient.put<TranscriptReviewItem>(`/api/transcripts/${id}/deploy`);
  return res.data;
};

export const getMyAssignments = async (): Promise<TranscriptReviewItem[]> => {
  const res = await apiClient.get<TranscriptReviewItem[]>("/api/transcripts/my-assignments");
  return res.data;
};

// ── Transcript editor ─────────────────────────────────────────────────────────

export interface TranscriptEditorData {
  id: number;
  videoId: number;
  videoTitle: string;
  audioUrl?: string;
  localeCode: string;
  localeName: string;
  approvalStatus: string;
  originalSrt: string | null;
  level1Srt: string | null;
  level2Srt: string | null;
  l1ReviewSubmitted: boolean;
  l2ReviewSubmitted: boolean;
  level1ProofreaderId: number | null;
  level2ProofreaderId: number | null;
  deployed: boolean;
}

export const getTranscriptForEditor = async (id: number): Promise<TranscriptEditorData> => {
  const res = await apiClient.get<TranscriptEditorData>(`/api/transcripts/${id}/editor`);
  return res.data;
};

export const saveTranscriptDraft = async (id: number, level: 1 | 2, srtContent: string): Promise<void> => {
  await apiClient.put(`/api/transcripts/${id}/save-draft`, { level, srtContent });
};

export const submitTranscriptReview = async (id: number, level: 1 | 2, srtContent: string): Promise<void> => {
  await apiClient.put(`/api/transcripts/${id}/submit-review`, { level, srtContent });
};

export const publishTranscript = async (id: number, srtContent: string): Promise<void> => {
  await apiClient.put(`/api/transcripts/${id}/publish`, { level: 0, srtContent });
};

export const getSubmittedReviews = async (): Promise<TranscriptReviewItem[]> => {
  const res = await apiClient.get<TranscriptReviewItem[]>("/api/transcripts/submitted-reviews");
  return res.data;
};

export const getProofreaders = async (localeCode?: string): Promise<UserSearchResult[]> => {
  const params = localeCode ? `?localeCode=${encodeURIComponent(localeCode)}` : "";
  const res = await apiClient.get<UserSearchResult[]>(`/api/users/proofreaders${params}`);
  return res.data;
};

export const getUserLocales = async (userId: number): Promise<LocaleInfo[]> => {
  const res = await apiClient.get<LocaleInfo[]>(`/api/users/${userId}/locales`);
  return res.data;
};

export const setUserLocales = async (userId: number, localeIds: number[]): Promise<LocaleInfo[]> => {
  const res = await apiClient.put<LocaleInfo[]>(`/api/users/${userId}/locales`, { localeIds });
  return res.data;
};

export const getAllLocales = async (): Promise<LocaleInfo[]> => {
  const res = await apiClient.get<LocaleInfo[]>("/locales");
  return res.data;
};

export const createLocale = async (code: string, name: string): Promise<LocaleInfo> => {
  const res = await apiClient.post<LocaleInfo>("/locales", { code, name });
  return res.data;
};

export const deleteLocale = async (id: number): Promise<void> => {
  await apiClient.delete(`/locales/${id}`);
};

// ── S3 upload ─────────────────────────────────────────────────────────────────

export const uploadImage = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await apiClient.post<{ url: string }>("/api/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data.url;
};
