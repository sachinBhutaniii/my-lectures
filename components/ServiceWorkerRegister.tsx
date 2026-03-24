"use client";
import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("serviceWorker" in navigator) {
      const onLoad = () => {
        navigator.serviceWorker
          .register("/sw.js", { scope: "/" })
          .then((reg) => {
            console.log("✓ Service worker registered:", reg);

            // Check for updates periodically
            setInterval(() => {
              reg
                .update()
                .catch((err) => console.warn("SW update check failed:", err));
            }, 60000); // Check every minute

            // Listen for updates
            reg.addEventListener("updatefound", () => {
              const newWorker = reg.installing;
              if (!newWorker) return;

              newWorker.addEventListener("statechange", () => {
                if (
                  newWorker.state === "installed" &&
                  navigator.serviceWorker.controller
                ) {
                  console.log("New service worker available, reload to update");
                  // Optional: Show toast/notification to user about update
                }
              });
            });
          })
          .catch(async (err) => {
            console.warn("✗ Service worker registration failed:", err);
            // Auto-recovery: unregister any stale/broken SW registrations and retry once
            try {
              const regs = await navigator.serviceWorker.getRegistrations();
              await Promise.all(regs.map((r) => r.unregister()));
              await navigator.serviceWorker.register("/sw.js", { scope: "/" });
              console.log("✓ Service worker re-registered after initial failure");
            } catch (retryErr) {
              console.warn("✗ Service worker retry also failed:", retryErr);
            }
          });
      };

      if (document.readyState === "loading") {
        window.addEventListener("load", onLoad);
        return () => window.removeEventListener("load", onLoad);
      } else {
        onLoad();
      }
    } else {
      console.warn("Service workers not supported");
    }
  }, []);

  return null;
}
