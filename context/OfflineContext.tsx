"use client";
import React, { createContext, useContext, useEffect, useState } from "react";

interface OfflineContextType {
  isOnline: boolean;
  hasServiceWorker: boolean;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [hasServiceWorker, setHasServiceWorker] = useState(false);

  useEffect(() => {
    // Set initial state
    setIsOnline(navigator.onLine);
    setHasServiceWorker("serviceWorker" in navigator);

    const handleOnline = () => {
      console.log("[Offline] Connection restored");
      setIsOnline(true);
    };

    const handleOffline = () => {
      console.log("[Offline] Connection lost");
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Verify connectivity with periodic ping
    const connectivityCheck = setInterval(() => {
      if (navigator.onLine) {
        fetch("/manifest.json", { method: "HEAD", cache: "no-cache" })
          .then(() => setIsOnline(true))
          .catch(() => setIsOnline(false));
      }
    }, 30000); // Check every 30 seconds

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(connectivityCheck);
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
