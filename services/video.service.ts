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


export const getLanguageData = async (): Promise<LanguageData[]> => {
  const response = await apiClient.get<LanguageData[]>(LANGUAGE_API_URL);
  return response.data;
};

// ── User management ──────────────────────────────────────────────────────────

export interface UserSearchResult {
  id: number;
  email: string;
  name: string;
  avatarUrl?: string;
  role: string;
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
}

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

// ── S3 upload ─────────────────────────────────────────────────────────────────

export const uploadImage = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await apiClient.post<{ url: string }>("/api/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data.url;
};
