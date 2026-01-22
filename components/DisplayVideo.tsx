"use client"
import { useState } from "react";

type DisplayVideoProps = {
  videoUrl : string
}

const DisplayVideo = ({videoUrl } : DisplayVideoProps) => {

    const [isLoaded, setIsLoaded] = useState(false);

    return <div className="relative m-4 w-full max-w-xl mx-auto aspect-video">

      {!isLoaded && (
        <div className="absolute inset-0 animate-pulse bg-gray-200 flex items-center justify-center rounded">
          <span>Loading Video...</span>
        </div>
      )}

         <iframe 
                // src={'https://www.youtube.com/watch?v=LqVDE2OvWKY'} // this does not work in iframe
                src={videoUrl}
                //  width={800}
                // height={450}
                // className="p-4 sm:p-6 lg:p-8 w-lg sm:w-4xl h-auto sm:h-[400px] md:h-[500px]"
                // className="m-4 p-8 sm:w-2xl sm:h-[500px] -w-lg h-[300px]"
                className="w-full h-full rounded"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
                onLoad={() => setIsLoaded(true)}
        />
    </div>
}

export default DisplayVideo