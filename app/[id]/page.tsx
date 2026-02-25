import { getVideos } from "@/services/video.service";
import LecturePageClient from "./LecturePageClient";

// Allow pages not returned by generateStaticParams to be rendered on-demand
export const dynamicParams = true;

// Pre-generate a page for every lecture at build time
export async function generateStaticParams() {
  try {
    const data = await getVideos();
    return (data.videos ?? []).map((v) => ({ id: String(v.id) }));
  } catch {
    return [];
  }
}

export default function LecturePage() {
  return <LecturePageClient />;
}
