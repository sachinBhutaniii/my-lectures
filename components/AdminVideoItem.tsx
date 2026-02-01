"use client";
import { LectureVideo } from "@/types/videos";
import { useRouter } from "next/navigation";

// Use same props structure but with full video object for editing
type AdminVideoItemProps = {
    video: LectureVideo;
    onEdit: (video: LectureVideo) => void;
};

const AdminVideoItem = ({ video, onEdit }: AdminVideoItemProps) => {

    const router = useRouter();
    
    // Kept navigation behavior but blocked propagation on edit button
    const goToAbout = () => {
        router.push(`/${video.id}`);
    };

    return (
        <article onClick={goToAbout} className="relative cursor-pointer overflow-hidden rounded-lg shadow-sm transition hover:shadow-lg h-full group bg-white flex flex-col">
            <div className="relative">
                <img alt={video.title} src={video.thumbnailUrl} className="h-56 w-full object-cover p-2 rounded-lg" />
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onEdit(video);
                    }}
                    className="absolute top-4 right-4 bg-white/90 text-amber-600 p-2 rounded-full shadow-md hover:bg-amber-600 hover:text-white transition-colors cursor-pointer"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                    </svg>
                </button>
            </div>

            <div className="bg-white p-4 sm:p-6 flex-1">
                <a href="#">
                    <h3 className="mt-0.5 text-lg text-amber-500 font-medium">
                        {video.title}
                    </h3>
                </a>
            </div>
        </article>
    );
}

export default AdminVideoItem;
