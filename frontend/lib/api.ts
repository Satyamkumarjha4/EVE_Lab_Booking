import type {
  Booking,
  Centre,
  CentreTest,
  CreatedBooking,
  Me,
  Payment,
  PaymentMethod,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type Tokens = { access: string; refresh: string };

let currentTokens: Tokens | null = null;
let onAuthFailure: (() => void) | null = null;

export function setTokens(tokens: Tokens | null) {
  currentTokens = tokens;
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

async function tryRefresh(refresh: string): Promise<string | null> {
  const res = await fetch(`${API_BASE}/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access: string };
  return data.access;
}

async function apiFetch(
  path: string,
  init: RequestInit = {},
  isRetry = false
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (currentTokens?.access) {
    headers.set("Authorization", `Bearer ${currentTokens.access}`);
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (res.status === 401 && !isRetry && currentTokens?.refresh) {
    const newAccess = await tryRefresh(currentTokens.refresh);
    if (newAccess) {
      currentTokens = { ...currentTokens, access: newAccess };
      return apiFetch(path, init, true);
    }
    currentTokens = null;
    onAuthFailure?.();
  }

  return res;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, body);
  }
  return body as T;
}

export function login(email: string, password: string) {
  return request<Tokens>("/auth/login/", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function signup(email: string, password: string) {
  return request<{ id: number; email: string }>("/auth/signup/", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function me() {
  return request<Me>("/auth/me/");
}

export function listCentres() {
  return request<Centre[]>("/centres/");
}

export function listCentreTests(centreId: number) {
  return request<CentreTest[]>(`/centres/${centreId}/tests/`);
}

export function createBooking(centreTestId: number, appointmentAt: string) {
  return request<CreatedBooking>("/bookings/", {
    method: "POST",
    body: JSON.stringify({ centre_test: centreTestId, appointment_at: appointmentAt }),
  });
}

export function listBookings() {
  return request<Booking[]>("/bookings/");
}

export function cancelBooking(bookingId: number) {
  return request<Booking>(`/bookings/${bookingId}/cancel/`, { method: "POST" });
}

export function createPaymentOrder(bookingId: number, method: PaymentMethod) {
  return request<Payment>("/payments/orders/", {
    method: "POST",
    body: JSON.stringify({ booking: bookingId, method }),
  });
}

export function simulatePayment(paymentReference: string, outcome: "SUCCESS" | "FAILED") {
  return request<Payment>("/payments/", {
    method: "POST",
    body: JSON.stringify({ payment_reference: paymentReference, outcome }),
  });
}
