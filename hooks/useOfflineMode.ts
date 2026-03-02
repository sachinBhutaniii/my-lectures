import { useOffline } from "@/context/OfflineContext";

/**
 * Hook to handle offline-specific logic
 * Usage: const { offlineMode, isOnline } = useOfflineMode();
 */
export function useOfflineMode() {
  const { isOnline, hasServiceWorker } = useOffline();

  return {
    isOnline,
    isOffline: !isOnline,
    offlineMode: !isOnline && hasServiceWorker,
    hasServiceWorker,
  };
}
