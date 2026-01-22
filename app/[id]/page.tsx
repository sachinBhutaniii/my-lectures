"use client"
import DisplayVideo from "@/components/DisplayVideo";
import LanguageTabs from "@/components/LanguageTabs";
import { useParams } from "next/navigation";
import { LectureVideo, VideoDetailResponse } from "@/types/videos";
import { getVideoById } from "@/services/video.service";
import { useFetch } from "@/hooks/useFetch";
import { useCallback, useState } from "react";
import CustomLoader from "@/components/CustomLoader";

const LecturePage = () => {
    const params = useParams<{ id: string }>();
    const [selectedLanguage,setSelectedLanguage] = useState('');

    const videoId = Number(params.id);

    const fetchVideo = useCallback(() => {
      return getVideoById(videoId, selectedLanguage);
    }, [videoId, selectedLanguage]);

    const toggleSelectedLanguage = (languageCode : string) => {
        setSelectedLanguage(languageCode)
    }

   const { data, loading, error } = useFetch<LectureVideo>(fetchVideo);

    return <div className="p-1 sm:p-8 flex flex-col justify-center items-center m-8">
      
         <h3 className="mt-1 sm:mt-4 text-base sm:text-lg font-medium sm:text-4xl cursor-pointer ">
             <span className="text-amber-600"> {data?.title} </span>
        </h3>
        {
        loading && <div className="flex justify-center items-center">
            <CustomLoader />
            </div>
        }

          {
            data?.videoUrl && <DisplayVideo videoUrl={data?.videoUrl} />
          }
        
          {data &&  <div className="flex flex-col justify-center items-center">
              <LanguageTabs transcript={data?.transcript} toggleSelectedLanguage={toggleSelectedLanguage} />
            </div>
          }
        </div>
}

export default LecturePage