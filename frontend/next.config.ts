import type { NextConfig } from "next";

// Static export for GitHub Pages. In production the site lives under
// https://www.vishnugandarapu.in/world-of-books, so CI builds with
// NEXT_PUBLIC_BASE_PATH=/world-of-books; local dev leaves it empty.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  // The home page and sitemap fetch the menu from the API at build time; the
  // free API host can take about a minute to wake up.
  staticPageGenerationTimeout: 180,
};

export default nextConfig;
