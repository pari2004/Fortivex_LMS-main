/**
 * Frontend environment configuration.
 *
 * Single API URL Strategy:
 * Browser-side requests use same-origin relative URLs by default (config.apiUrl = "").
 * Next.js server proxies `/api/:path*` to the internal backend destination.
 * If NEXT_PUBLIC_API_URL is explicitly set to an external URL, it will be used as the base.
 */

function getEnv(name: string, fallback: string = ""): string {
  return process.env[name] ?? fallback;
}

export const config = {
  // Empty string by default: browser makes same-origin relative requests e.g. "/api/v1/..."
  apiUrl: (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, ""),
  appEnv: getEnv("NEXT_PUBLIC_APP_ENV", "development"),
};

/**
 * Builds a properly formatted, deployment-independent API URL.
 * - When config.apiUrl is "" (the default), returns same-origin relative paths like "/api/v1/auth/me".
 * - When config.apiUrl is set (e.g. "https://api.example.com"), returns "https://api.example.com/api/v1/auth/me".
 * - Automatically ensures a single leading slash and avoids malformed double slashes ("//api/...").
 */
export function buildApiUrl(path: string): string {
  const base = (config.apiUrl || "").replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
