"use client";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";

interface OfflineContextType {
  isOnline: boolean;
  hasServiceWorker: boolean;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [hasServiceWorker, setHasServiceWorker] = useState(false);
  const offlineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    setHasServiceWorker("serviceWorker" in navigator);

    const handleOnline = () => {
      if (offlineTimer.current) clearTimeout(offlineTimer.current);
      setIsOnline(true);
    };

    // Only mark offline after 5 s of sustained disconnection to avoid false positives
    const handleOffline = () => {
      offlineTimer.current = setTimeout(() => setIsOnline(false), 5000);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (offlineTimer.current) clearTimeout(offlineTimer.current);
    };
  }, []);

  return (
    <OfflineContext.Provider value={{ isOnline, hasServiceWorker }}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (context === undefined) {
    throw new Error("useOffline must be used within OfflineProvider");
  }
  return context;
}
