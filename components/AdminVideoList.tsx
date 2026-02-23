"use client";
import React, { useState, useCallback } from "react";
import { useFetch } from "@/hooks/useFetch";
import { getVideos, createVideo, updateVideo } from "@/services/video.service";
import { VideoApiResponse, LectureVideo } from "@/types/videos";
import AdminVideoItem from "./AdminVideoItem";
import VideoForm from "./VideoForm";

const AdminVideoList = () => {
  const fetchFn = useCallback(() => getVideos(), []);
  const { data, loading, setData } = useFetch<VideoApiResponse>(fetchFn);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<LectureVideo | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState("");

  const openAdd = () => {
    setEditingVideo(null);
    setPanelOpen(true);
  };

  const openEdit = (video: LectureVideo) => {
    setEditingVideo(video);
    setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setEditingVideo(null);
  };

  const handleFormSubmit = async (formData: Omit<LectureVideo, "id">) => {
    setIsSaving(true);
    try {
      if (editingVideo) {
        const updated = await updateVideo(editingVideo.id, formData);
        if (data) {
          setData({ ...data, videos: data.videos.map((v) => (v.id === editingVideo.id ? updated : v)) });
        }
      } else {
        const created = await createVideo(formData);
        if (data) {
          setData({ ...data, videos: [...data.videos, created], totalVideos: data.totalVideos + 1 });
        }
      }
      closePanel();
    } catch {
      alert("Failed to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredVideos = (data?.videos ?? []).filter((v) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      v.title.toLowerCase().includes(q) ||
      (v.description ?? "").toLowerCase().includes(q) ||
      (v.keywords ?? []).some((k) => k.toLowerCase().includes(q))
    );
  });

  return (
    <>
      {/* Header row */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search lectures…"
            className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-600 outline-none"
          />
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors flex-shrink-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add
        </button>
      </div>

      {/* Stats */}
      <p className="text-xs text-gray-600 mb-4">
        {loading ? "Loading…" : `${filteredVideos.length} lecture${filteredVideos.length !== 1 ? "s" : ""}`}
        {search && data && ` of ${data.totalVideos} total`}
      </p>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12 mx-auto mb-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
          <p className="text-sm">{search ? "No lectures match your search" : "No lectures yet. Click Add to create one."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-16">
          {filteredVideos.map((video) => (
            <AdminVideoItem key={video.id} video={video} onEdit={openEdit} />
          ))}
        </div>
      )}

      {/* Slide-in edit panel */}
      {panelOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={closePanel} />

          {/* Panel */}
          <div className="w-full max-w-md bg-[#0d0d0d] border-l border-gray-800 flex flex-col h-full overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Panel header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-800 flex-shrink-0">
              <button onClick={closePanel} className="text-gray-500 hover:text-gray-200 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
              <h2 className="text-base font-semibold text-white">
                {editingVideo ? "Edit Lecture" : "Add Lecture"}
              </h2>
              {editingVideo && (
                <span className="ml-auto text-xs text-gray-600 font-mono">ID #{editingVideo.id}</span>
              )}
            </div>

            {/* Scrollable form */}
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <VideoForm
                initialData={editingVideo || undefined}
                videoId={editingVideo?.id}
                onSubmit={handleFormSubmit}
                onCancel={closePanel}
                isLoading={isSaving}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminVideoList;
