"use client";
import { useOffline } from "@/context/OfflineContext";

export default function OfflineIndicator() {
  const { isOnline, hasServiceWorker } = useOffline();

  if (isOnline || !hasServiceWorker) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-3 flex items-center justify-between animate-pulse">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-red-900 rounded-full"></div>
        <span className="text-sm font-medium">
          You're offline - cached content available
        </span>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="text-xs bg-red-700 px-3 py-1 rounded hover:bg-red-800 transition"
      >
        Retry
      </button>
    </div>
  );
}
