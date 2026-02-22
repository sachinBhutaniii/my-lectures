export interface LectureVideo {
  id: number;
  title: string;
  thumbnailUrl: string;
  videoUrl: string;
  audioUrl?: string;
  transcript : string;
  transcriptSrt?: string;
  key?: string;
  date?: string;
  speaker?: string;
  place?: {
    city: string;
    country: string;
  };
  category?: string[];
  startTime?: number;
}


export interface VideoApiResponse {
  success: boolean;
  totalVideos: number;
  videos: LectureVideo[];
}


export interface VideoDetailResponse {
  success: boolean;
  videos: LectureVideo[];
}


export interface LanguageData {
  code : string,
  id : number,
  name : string
}