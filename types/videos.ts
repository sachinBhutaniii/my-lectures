export interface LectureVideo {
  id: number;
  title: string;
  thumbnailUrl: string;
  videoUrl: string;
  transcript : string
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