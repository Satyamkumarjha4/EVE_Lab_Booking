const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const REFRESH_STORAGE_KEY = "eve.refresh";

export type Tokens = { access: string; refresh: string };

let currentTokens: Tokens | null = null;
let onAuthFailure: (() => void) | null = null;
// Several requests can hit an expired access token at once; they share one refresh call.
let refreshInFlight: Promise<string | null> | null = null;

function writeStoredRefresh(refresh: string | null) {
  try {
    if (refresh) localStorage.setItem(REFRESH_STORAGE_KEY, refresh);
    else localStorage.removeItem(REFRESH_STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the session stays in memory.
  }
}

function readStoredRefresh(): string | null {
  try {
    return localStorage.getItem(REFRESH_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setTokens(tokens: Tokens | null) {
  currentTokens = tokens;
  writeStoredRefresh(tokens?.refresh ?? null);
}

export function setAuthFailureHandler(handler: (() => void) | null) {
  onAuthFailure = handler;
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(`API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function requestAccess(refresh: string): Promise<string | null> {
  const res = await fetch(`${API_BASE}/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access: string };
  return data.access;
}

function refreshAccess(refresh: string): Promise<string | null> {
  refreshInFlight ??= requestAccess(refresh).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/** Re-establishes a session from the refresh token persisted by a previous visit. */
export async function restoreSession(): Promise<boolean> {
  const refresh = readStoredRefresh();
  if (!refresh) return false;
  const access = await refreshAccess(refresh).catch(() => null);
  if (!access) {
    setTokens(null);
    return false;
  }
  currentTokens = { access, refresh };
  return true;
}

async function apiFetch(path: string, init: RequestInit = {}, isRetry = false): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (currentTokens?.access) {
    headers.set("Authorization", `Bearer ${currentTokens.access}`);
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (res.status === 401 && !isRetry && currentTokens?.refresh) {
    const newAccess = await refreshAccess(currentTokens.refresh);
    if (newAccess && currentTokens) {
      currentTokens = { ...currentTokens, access: newAccess };
      return apiFetch(path, init, true);
    }
    setTokens(null);
    onAuthFailure?.();
  }

  return res;
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, body);
  }
  return body as T;
}

/** Turns a DRF error body ({detail} or {field: [messages]}) into one readable sentence. */
export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!(err instanceof ApiError)) {
    return err instanceof TypeError ? "Can't reach the server. Is the backend running?" : fallback;
  }
  if (err.status === 429) return "Too many requests. Please wait a minute and try again.";
  const body = err.body;
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.detail === "string") return record.detail;
    for (const value of Object.values(record)) {
      if (Array.isArray(value) && typeof value[0] === "string") return value[0];
      if (typeof value === "string") return value;
    }
  }
  return fallback;
}
