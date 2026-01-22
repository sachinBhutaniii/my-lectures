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


export const getLanguageData = async (): Promise<LanguageData[]> => {
  const response = await apiClient.get<LanguageData[]>(LANGUAGE_API_URL);
  return response.data;
};
