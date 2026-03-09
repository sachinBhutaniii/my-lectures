import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { PlayerProvider } from "@/context/PlayerContext";
import { OfflineProvider } from "@/context/OfflineContext";
import PlayerSheet from "@/components/PlayerSheet";
import TripleTapFullscreen from "@/components/TripleTapFullscreen";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import InstallPrompt from "@/components/InstallPrompt";
import OfflineIndicator from "@/components/OfflineIndicator";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BDD Swami Lectures",
  description: "Divine Teachings of His Holiness Bhakti Dhira Damodara Swami",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#1a1208" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/bdds.jpg" />
        <link rel="apple-touch-icon" href="/bdds.jpg" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#1a1208] text-white`}
        suppressHydrationWarning
      >
        <OfflineProvider>
          <AuthProvider>
            <LanguageProvider>
            <PlayerProvider>
              <TripleTapFullscreen>
                <OfflineIndicator />
                {children}
                <PlayerSheet />
                <ServiceWorkerRegister />
                <InstallPrompt />
              </TripleTapFullscreen>
            </PlayerProvider>
            </LanguageProvider>
          </AuthProvider>
        </OfflineProvider>
      </body>
    </html>
  );
}
