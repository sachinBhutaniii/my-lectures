"use client";
import React, { useEffect, useState } from "react";

const STORAGE_KEY = "pwa-install-shown";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const shown = localStorage.getItem(STORAGE_KEY);
    if (shown) return;

    const ua = window.navigator.userAgent.toLowerCase();
    const isInStandaloneMode =
      "standalone" in window.navigator &&
      Boolean((window.navigator as any).standalone);
    const ios = /iphone|ipad|ipod/.test(ua) && !isInStandaloneMode;
    setIsIos(ios);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };

    window.addEventListener(
      "beforeinstallprompt",
      onBeforeInstall as EventListener,
    );

    // If iOS (no beforeinstallprompt), show the banner once on first visit
    if (ios) setVisible(true);

    return () =>
      window.removeEventListener(
        "beforeinstallprompt",
        onBeforeInstall as EventListener,
      );
  }, []);

  const markSeen = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
  };

  const onInstallClick = async () => {
    if (deferredPrompt) {
      try {
        // @ts-ignore
        deferredPrompt.prompt();
        // @ts-ignore
        const choice = await deferredPrompt.userChoice;
        if (choice && choice.outcome) {
          // accepted or dismissed
        }
      } catch (err) {
        /* ignore */
      }
    } else if (isIos) {
      // For iOS we can't prompt programmatically; show a simple alert like before
      alert(
        "To install on iOS: tap the Share button in Safari (the square with an arrow), then choose 'Add to Home Screen'.",
      );
    } else {
      // Fallback: open manifest url
      window.open("/manifest.json", "_blank");
    }

    markSeen();
    setVisible(false);
    setDeferredPrompt(null);
  };

  const onDismiss = () => {
    markSeen();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={containerStyle} className="pwa-install-banner">
      <div style={textStyle}>Install the app for quick access.</div>
      <div style={buttonsStyle}>
        <button onClick={onInstallClick} style={installBtnStyle}>
          Install
        </button>
        <button onClick={onDismiss} style={dismissBtnStyle}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  position: "fixed",
  left: "50%",
  bottom: "calc(12px + env(safe-area-inset-bottom))",
  transform: "translateX(-50%)",
  background: "#111",
  color: "#fff",
  borderRadius: 12,
  padding: "12px 14px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  gap: 12,
  maxWidth: "92%",
  width: "min(720px, calc(100% - 32px))",
};

const textStyle: React.CSSProperties = {
  flex: 1,
  fontSize: 14,
  lineHeight: "1.2",
};

const buttonsStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
};

const installBtnStyle: React.CSSProperties = {
  background: "#f5d7b0",
  color: "#1a1208",
  border: "none",
  padding: "8px 12px",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
};

const dismissBtnStyle: React.CSSProperties = {
  background: "transparent",
  color: "#cfcfcf",
  border: "none",
  cursor: "pointer",
  fontSize: 13,
};
