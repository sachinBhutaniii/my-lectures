import { LectureVideo } from "@/types/videos";
import { useState, useEffect } from "react";

type VideoFormProps = {
  initialData?: Partial<LectureVideo>;
  onSubmit: (data: Omit<LectureVideo, "id">) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
};

const VideoForm = ({ initialData, onSubmit, onCancel, isLoading }: VideoFormProps) => {
  const [formData, setFormData] = useState<Omit<LectureVideo, "id">>({
    title: "",
    videoUrl: "",
    thumbnailUrl: "",
    transcript: "",
    transcriptSrt: "",
    key: "",
    date: new Date().toISOString().split('T')[0],
    speaker: "",
    place: { city: "", country: "" },
    category: [],
  });

  const [categoryInput, setCategoryInput] = useState("");

  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title || "",
        videoUrl: initialData.videoUrl || "",
        thumbnailUrl: initialData.thumbnailUrl || "",
        transcript: initialData.transcript || "",
        transcriptSrt: initialData.transcriptSrt || "",
        key: initialData.key || "",
        date: initialData.date || new Date().toISOString().split('T')[0],
        speaker: initialData.speaker || "",
        place: initialData.place || { city: "", country: "" },
        category: initialData.category || [],
      });
      setCategoryInput(initialData.category?.join(", ") || "");
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePlaceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      place: { ...(prev.place || { city: "", country: "" }), [name]: value },
    }));
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCategoryInput(e.target.value);
    setFormData((prev) => ({
      ...prev,
      category: e.target.value.split(",").map((c) => c.trim()).filter((c) => c),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Title</label>
        <input
          type="text"
          name="title"
          required
          value={formData.title}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">Video URL</label>
          <input
            type="text"
            name="videoUrl"
            required
            value={formData.videoUrl}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Thumbnail URL</label>
          <input
            type="text"
            name="thumbnailUrl"
            required
            value={formData.thumbnailUrl}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2"
          />
        </div>
      </div>

       <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
           <label className="block text-sm font-medium text-gray-700">Speaker</label>
           <input
             type="text"
             name="speaker"
             value={formData.speaker}
             onChange={handleChange}
             className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2"
           />
        </div>
        <div>
           <label className="block text-sm font-medium text-gray-700">Date</label>
           <input
             type="date"
             name="date"
             value={formData.date}
             onChange={handleChange}
             className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2"
           />
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">City</label>
            <input
              type="text"
              name="city"
              value={formData.place?.city || ""}
              onChange={handlePlaceChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Country</label>
            <input
              type="text"
              name="country"
              value={formData.place?.country || ""}
              onChange={handlePlaceChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2"
            />
          </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Transcript</label>
        <textarea
          name="transcript"
          rows={3}
          value={formData.transcript}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2"
        />
      </div>

       <div>
        <label className="block text-sm font-medium text-gray-700">Transcript SRT</label>
        <textarea
          name="transcriptSrt"
          rows={2}
          value={formData.transcriptSrt}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
         <div>
            <label className="block text-sm font-medium text-gray-700">Key (SKU)</label>
            <input
              type="text"
              name="key"
              value={formData.key}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2"
            />
         </div>
         <div>
            <label className="block text-sm font-medium text-gray-700">Categories (comma separated)</label>
            <input
              type="text"
              value={categoryInput}
              onChange={handleCategoryChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2"
            />
         </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-md border border-transparent bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50 cursor-pointer"
        >
          {isLoading ? "Saving..." : "Save Video"}
        </button>
      </div>
    </form>
  );
};

export default VideoForm;
