"use client";
import React, { useEffect, useState } from "react";

// track whether the install flow was triggered at least once
const INSTALLED_KEY = "pwa-installed";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // don't show again if the user has previously tapped install
    if (localStorage.getItem(INSTALLED_KEY)) return;

    const ua = window.navigator.userAgent.toLowerCase();
    const isInStandaloneMode =
      "standalone" in window.navigator &&
      Boolean((window.navigator as any).standalone);
    const ios = /iphone|ipad|ipod/.test(ua) && !isInStandaloneMode;
    setIsIos(ios);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // browser is signalling installability; ensure banner is visible
      setVisible(true);
    };

    window.addEventListener(
      "beforeinstallprompt",
      onBeforeInstall as EventListener,
    );

    // always show banner on first render, regardless of platform/event
    setVisible(true);

    return () =>
      window.removeEventListener(
        "beforeinstallprompt",
        onBeforeInstall as EventListener,
      );
  }, []);

  const markInstalled = () => {
    try {
      localStorage.setItem(INSTALLED_KEY, "1");
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
      // Desktop or unsupported environment - provide manual instructions
      alert(
        "Installation isn't automatic on this browser. " +
          "Look for the install option in your browser's menu (e.g. " +
          "Chrome/Edge 'Install app' or the plus icon in the address bar).",
      );
    }

    markInstalled();
    setVisible(false);
    setDeferredPrompt(null);
  };

  const onDismiss = () => {
    // don't treat dismissal as installation; just hide until next full load
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
