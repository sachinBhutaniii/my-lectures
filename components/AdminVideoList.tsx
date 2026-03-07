"use client";
import React, { useState, useCallback } from "react";
import { useFetch } from "@/hooks/useFetch";
import { getVideos, createVideo, updateVideo, deleteVideo } from "@/services/video.service";
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
  const [deleteConfirm, setDeleteConfirm] = useState<LectureVideo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleFormSubmit = async (formData: Omit<LectureVideo, "id">, pipelineCreatedVideoId?: number) => {
    setIsSaving(true);
    try {
      if (editingVideo) {
        const updated = await updateVideo(editingVideo.id, formData);
        if (data) {
          setData({ ...data, videos: data.videos.map((v) => (v.id === editingVideo.id ? updated : v)) });
        }
      } else if (pipelineCreatedVideoId) {
        // Pipeline already created the video — just update it with any form edits
        const updated = await updateVideo(pipelineCreatedVideoId, formData);
        if (data) {
          setData({ ...data, videos: [...data.videos, updated], totalVideos: data.totalVideos + 1 });
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

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    try {
      await deleteVideo(deleteConfirm.id);
      if (data) {
        setData({
          ...data,
          videos: data.videos.filter((v) => v.id !== deleteConfirm.id),
          totalVideos: data.totalVideos - 1,
        });
      }
      setDeleteConfirm(null);
    } catch {
      alert("Failed to delete. Please try again.");
    } finally {
      setIsDeleting(false);
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
            <AdminVideoItem key={video.id} video={video} onEdit={openEdit} onDelete={setDeleteConfirm} />
          ))}
        </div>
      )}

      {/* Slide-in edit panel */}
      {panelOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={closePanel} />

          {/* Panel */}
          <div className="w-full max-w-2xl bg-[#0d0d0d] border-l border-gray-800 flex flex-col h-full overflow-hidden animate-in slide-in-from-right duration-200">
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

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => { if (!isDeleting) setDeleteConfirm(null); }}
          />
          <div className="relative w-full max-w-sm bg-[#111] border border-gray-800 rounded-2xl p-6 shadow-2xl">
            {/* Warning icon */}
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-red-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>

            <h3 className="text-base font-semibold text-white text-center mb-1">Delete Lecture</h3>
            <p className="text-sm text-gray-400 text-center mb-1">This action cannot be undone.</p>
            <p className="text-sm font-medium text-gray-200 text-center line-clamp-2 px-2 mt-3 mb-5">
              &ldquo;{deleteConfirm.title}&rdquo;
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl border border-gray-700 text-sm text-gray-400 hover:border-gray-500 hover:text-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-medium text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminVideoList;
