"use client"
import ContentItem from "@/components/ContentItem";
import ContentList from "@/components/ContentList";
import CustomLoader from "@/components/CustomLoader";
import MainBanner from "@/components/MainBanner";
import { useFetch } from "@/hooks/useFetch";
import { getVideos } from "@/services/video.service";
import { VideoApiResponse } from "@/types/videos";


export default function Home() {
  const { data, loading, error } = useFetch<VideoApiResponse>(getVideos);
  return <>
    <MainBanner />
    <div className="mx-auto max-w-6xl p-6 sm:p-0">
    {
      loading && <div className="flex justify-center items-center">
          <CustomLoader />
        </div>
    }

        <div className="flex flex-wrap gap-6 mb-16">
          {data && data?.totalVideos > 0 && data?.videos?.map((item) => (
            <div
              key={item.id}
              className="flex-shrink-0 w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)]">
              <ContentItem title={item.title} thumbnailUrl={item.thumbnailUrl} id={item.id} />
            </div>
          ))}
        </div>
    </div>
  </>;
}
