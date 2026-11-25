import type { NextConfig } from "next";

/**
 * Determine internal backend destination URL for server-side proxying.
 * - In Docker Compose: INTERNAL_API_URL is configured as "http://backend:8000".
 * - In host-based local development: falls back to "http://127.0.0.1:8000".
 */
function getInternalApiUrl(): string {
  const envUrl = process.env.INTERNAL_API_URL || process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL;
  if (envUrl) {
    return envUrl.replace(/\/+$/, "");
  }
  // If running inside container or production environment
  if (process.env.NODE_ENV === "production" || process.env.HOSTNAME === "0.0.0.0") {
    return "http://backend:8000";
  }
  return "http://127.0.0.1:8000";
}

const internalApiUrl = getInternalApiUrl();

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost:3000",
    "127.0.0.1:3000",
    "localhost",
    "127.0.0.1",
    "*.ts.net",
  ],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${internalApiUrl}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${internalApiUrl}/uploads/:path*`,
      },
    ];
  },
  webpack: (config) => {
    config.watchOptions = {
      poll: 1000,
      aggregateTimeout: 300,
    };
    return config;
  },
  turbopack: {},
};

export default nextConfig;
