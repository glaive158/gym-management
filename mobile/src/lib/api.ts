import Constants from "expo-constants";

const BASE = (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ?? "http://10.0.2.2:3000";

export const apiBaseUrl = BASE;

// Avatar / uploads are stored as relative paths (e.g. "/uploads/xxx.jpg") so
// the web app can serve them from the same origin. The mobile app needs the
// full URL — prefix any relative path with the API base.
export function absoluteUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}

export async function apiFetch<T = unknown>(
  path: string,
  opts: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json as T;
}
