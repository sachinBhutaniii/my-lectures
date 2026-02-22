import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",   // static HTML/CSS/JS — no server required
  distDir: "dist",    // output folder name
  trailingSlash: false,
  images: {
    unoptimized: true, // required for static export
  },
};

export default nextConfig;
