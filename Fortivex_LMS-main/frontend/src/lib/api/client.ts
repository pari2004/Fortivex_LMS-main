import { config, buildApiUrl } from "@/lib/config";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string;
  skipCache?: boolean;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const apiGetCache = new Map<string, CacheEntry<any>>();
const CACHE_TTL_MS = 25 * 1000; // 25 seconds client-side memory cache for smooth transitions
const NON_CACHEABLE_SUBSTRINGS = ["/heartbeat", "/execute", "/test", "/notifications", "/live/session"];

export function clearApiCache(pathPrefix?: string) {
  if (!pathPrefix) {
    apiGetCache.clear();
    return;
  }
  for (const key of apiGetCache.keys()) {
    if (key.includes(pathPrefix)) {
      apiGetCache.delete(key);
    }
  }
}

/**
 * Fast fetch wrapper against the FastAPI backend (`NEXT_PUBLIC_API_URL`).
 * Caches safe GET requests in-memory for 25s for instant page switching.
 * Automatically clears cache whenever a mutation occurs (POST/PUT/PATCH/DELETE).
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token, skipCache = false } = options;

  const isCacheable =
    method === "GET" &&
    !skipCache &&
    !NON_CACHEABLE_SUBSTRINGS.some((sub) => path.includes(sub));

  const cacheKey = `${token || "anon"}:${path}`;

  if (isCacheable) {
    const cached = apiGetCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data as T;
    }
  }

  // Any data mutation immediately invalidates cached reads
  if (method !== "GET") {
    apiGetCache.clear();
  }

  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = buildApiUrl(path);
  const response = await fetch(url, {
    method,
    headers,
    cache: "no-store",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let detail = response.statusText || `HTTP ${response.status}`;
    try {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await response.json();
        detail = data.detail ?? data.message ?? detail;
      } else {
        const text = await response.text();
        const clean = text.replace(/<[^>]*>/g, " ").trim();
        detail = clean.slice(0, 200) || detail;
      }
    } catch {
      // response body wasn't JSON or readable — fall back to statusText
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const result = (await response.json()) as T;
  if (isCacheable) {
    apiGetCache.set(cacheKey, { data: result, timestamp: Date.now() });
  }
  return result;
}
