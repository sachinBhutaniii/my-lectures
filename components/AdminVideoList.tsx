"use client";
import React, { useState } from 'react';
import { useFetch } from "@/hooks/useFetch";
import { getVideos, createVideo, updateVideo } from "@/services/video.service";
import { VideoApiResponse, LectureVideo } from "@/types/videos";
import CustomLoader from "@/components/CustomLoader";
import AdminVideoItem from "./AdminVideoItem";
import VideoForm from "./VideoForm";

const AdminVideoList = () => {
  const { data, loading, error, setData } = useFetch<VideoApiResponse>(getVideos);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<LectureVideo | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleAddClick = () => {
    setEditingVideo(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (video: LectureVideo) => {
    setEditingVideo(video);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingVideo(null);
  };

  const handleFormSubmit = async (formData: Omit<LectureVideo, "id">) => {
    setIsSaving(true);
    try {
      if (editingVideo) {
         const updated = await updateVideo(editingVideo.id, formData);
         // Update local state
         if(data) {
             const updatedVideos = data.videos.map(v => v.id === editingVideo.id ? updated : v);
             setData({ ...data, videos: updatedVideos });
         }
      } else {
         const created = await createVideo(formData);
         if(data) {
             setData({ ...data, videos: [...data.videos, created], totalVideos: data.totalVideos + 1 });
         }
      }
      handleModalClose();
    } catch (e) {
      console.error("Failed to save video:", e);
      alert("Failed to save video. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <>
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-semibold text-gray-800">Manage Videos</h2>
        <button 
            onClick={handleAddClick}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 cursor-pointer"
        >
            Add New Video
        </button>
      </div>

      {loading && <div className="flex justify-center items-center"><CustomLoader /></div>}
      
      {/* Grid Layout matches page.tsx */}
      <div className="flex flex-wrap gap-6 mb-16">
          {data && data?.totalVideos > 0 && data?.videos?.map((item) => (
             <div
               key={item.id}
               className="flex-shrink-0 w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)]">
               <AdminVideoItem video={item} onEdit={handleEditClick} />
             </div>
          ))}
          {!loading && data?.videos?.length === 0 && (
             <p className="text-gray-500">No videos found. Click "Add New Video" to create one.</p>
          )}
      </div>

      {/* Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={handleModalClose}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="relative z-50 inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full sm:p-6">
                <div className="absolute top-0 right-0 pt-4 pr-4">
                    <button onClick={handleModalClose} type="button" className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 cursor-pointer">
                    <span className="sr-only">Close</span>
                    <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    </button>
                </div>
              <div className="sm:flex sm:items-start w-full">
                <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                  <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                    {editingVideo ? "Edit Video" : "Add New Video"}
                  </h3>
                  <div className="mt-4">
                     <VideoForm 
                        initialData={editingVideo || undefined} 
                        onSubmit={handleFormSubmit} 
                        onCancel={handleModalClose}
                        isLoading={isSaving}
                     />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminVideoList;
