import type {
  Booking,
  Centre,
  CentreTest,
  DaySlots,
  FailureReason,
  LabSettings,
  Me,
  Patient,
  Payment,
  PaymentMethod,
  SlotRule,
  Test,
} from "../types";
import { request, type Tokens } from "./client";

export {
  ApiError,
  errorMessage,
  restoreSession,
  setAuthFailureHandler,
  setTokens,
  type Tokens,
} from "./client";

const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });
const patch = (body: unknown): RequestInit => ({ method: "PATCH", body: JSON.stringify(body) });
const postEmpty: RequestInit = { method: "POST" };

// --- Auth ---

export function login(email: string, password: string) {
  return request<Tokens>("/auth/login/", post({ email, password }));
}

export function signup(email: string, password: string) {
  return request<{ id: number; email: string }>("/auth/signup/", post({ email, password }));
}

export function me() {
  return request<Me>("/auth/me/");
}

// --- Catalog ---

export function listCentres() {
  return request<Centre[]>("/centres/");
}

export function createCentre(name: string, location: string) {
  return request<Centre>("/centres/", post({ name, location }));
}

export function updateCentre(centreId: number, changes: { name?: string; location?: string }) {
  return request<Centre>(`/centres/${centreId}/`, patch(changes));
}

export function listCentreTests(centreId: number, includeInactive = false) {
  const query = includeInactive ? "?include_inactive=true" : "";
  return request<CentreTest[]>(`/centres/${centreId}/tests/${query}`);
}

export function offerTest(centreId: number, testId: number, price: string) {
  return request<CentreTest>(`/centres/${centreId}/tests/`, post({ test: testId, price }));
}

export function updateCentreTest(
  centreId: number,
  centreTestId: number,
  changes: { price?: string; is_active?: boolean }
) {
  return request<CentreTest>(`/centres/${centreId}/tests/${centreTestId}/`, patch(changes));
}

export function listTests() {
  return request<Test[]>("/tests/");
}

export function getMyLab() {
  return request<LabSettings>("/labs/mine/");
}

export function updateMyLab(changes: { transaction_fee_percent?: string; name?: string }) {
  return request<LabSettings>("/labs/mine/", patch(changes));
}

// --- Slots ---

/** `from` is a local YYYY-MM-DD date; omit it for today. */
export function getSlots(centreId: number, days = 14, from?: string) {
  const query = new URLSearchParams({ days: String(days), ...(from ? { from } : {}) });
  return request<DaySlots[]>(`/centres/${centreId}/slots/?${query}`);
}

export function listSlotRules(centreId: number) {
  return request<SlotRule[]>(`/centres/${centreId}/slot-rules/`);
}

export type SlotRuleInput = Omit<SlotRule, "id">;

export function createSlotRule(centreId: number, rule: SlotRuleInput) {
  return request<SlotRule>(`/centres/${centreId}/slot-rules/`, post(rule));
}

export function updateSlotRule(centreId: number, ruleId: number, changes: Partial<SlotRuleInput>) {
  return request<SlotRule>(`/centres/${centreId}/slot-rules/${ruleId}/`, patch(changes));
}

export function deleteSlotRule(centreId: number, ruleId: number) {
  return request<null>(`/centres/${centreId}/slot-rules/${ruleId}/`, { method: "DELETE" });
}

// --- Patients (walk-in desk) ---

export function lookupPatient(email: string) {
  return request<Patient>(`/patients/lookup/?email=${encodeURIComponent(email)}`);
}

export type PatientInput = Omit<Patient, "id" | "full_name">;

export function registerPatient(patient: PatientInput) {
  return request<Patient>("/patients/", post(patient));
}

// --- Bookings ---

/** `patientId` is required for centre staff (walk-ins) and must be omitted for patients. */
export function createBooking(centreTestId: number, appointmentAt: string, patientId?: number) {
  return request<Booking>(
    "/bookings/",
    post({ centre_test: centreTestId, appointment_at: appointmentAt, patient: patientId })
  );
}

export function listBookings() {
  return request<Booking[]>("/bookings/");
}

export function getBooking(bookingId: number) {
  return request<Booking>(`/bookings/${bookingId}/`);
}

export function cancelBooking(bookingId: number, reason: string) {
  return request<Booking>(`/bookings/${bookingId}/cancel/`, post({ reason }));
}

export function completeBooking(bookingId: number) {
  return request<Booking>(`/bookings/${bookingId}/complete/`, postEmpty);
}

export function deliverReport(bookingId: number) {
  return request<Booking>(`/bookings/${bookingId}/deliver-report/`, postEmpty);
}

// --- Payments ---

export function createPaymentOrder(bookingId: number, method: PaymentMethod) {
  return request<Payment>("/payments/orders/", post({ booking: bookingId, method }));
}

export function simulatePayment(
  paymentReference: string,
  outcome: "SUCCESS" | "FAILED",
  failureReason?: FailureReason
) {
  return request<Payment>(
    "/payments/",
    post({ payment_reference: paymentReference, outcome, failure_reason: failureReason })
  );
}
