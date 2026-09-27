export type Role = "PLATFORM_ADMIN" | "LAB" | "CENTRE" | "CLIENT";

export interface Me {
  id: number;
  email: string;
  role: Role;
  lab: number | null;
  centre: number | null;
}

export interface Lab {
  id: number;
  name: string;
  /** Kept when a patient cancels a paid booking or doesn't turn up; the rest is refunded. */
  transaction_fee_percent: string;
}

export interface Centre {
  id: number;
  name: string;
  location: string;
  lab: Lab;
}

export interface Test {
  id: number;
  name: string;
  description: string;
}

export interface CentreTest {
  id: number;
  price: string;
  is_active: boolean;
  test: Test;
}

export type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "FAILED"
  | "CANCELLED"
  | "COMPLETED"
  | "NO_SHOW"
  | "REPORT_DELIVERED";

export type ActorRole = "CLIENT" | "CENTRE" | "LAB" | "PLATFORM_ADMIN" | "SYSTEM";

export interface BookingCentreTest {
  id: number;
  centre: Centre;
  test: Test;
  price: string;
}

export interface PatientSummary {
  id: number;
  email: string;
  full_name: string;
  phone: string;
}

export interface BookingEvent {
  status: BookingStatus;
  actor_role: ActorRole;
  note: string;
  created_at: string;
}

export interface PaymentSummary {
  method: PaymentMethod;
  status: PaymentStatus;
  failure_reason: FailureReason | "";
  refund_status: RefundStatus;
  refund_amount: string;
  fee_amount: string;
}

export interface Booking {
  id: number;
  client: number | null;
  patient: PatientSummary | null;
  centre_test: BookingCentreTest;
  appointment_at: string;
  amount: string;
  status: BookingStatus;
  payment: PaymentSummary | null;
  cancellation: { reason: string; by_role: ActorRole; at: string } | null;
  events: BookingEvent[];
  created_at: string;
  updated_at: string;
}

export type PaymentMethod = "CARD" | "UPI";
export type PaymentStatus = "INITIATED" | "SUCCESS" | "FAILED";
export type RefundStatus = "NONE" | "SIMULATED_REFUNDED";
export type FailureReason =
  | "INSUFFICIENT_FUNDS"
  | "CARD_DECLINED"
  | "INCORRECT_PIN"
  | "AUTHENTICATION_FAILED"
  | "BANK_UNAVAILABLE"
  | "TIMED_OUT";

export interface Payment extends PaymentSummary {
  id: number;
  reference: string;
  booking: number;
  amount: string;
  created_at: string;
  updated_at: string;
}

export type Gender = "MALE" | "FEMALE" | "OTHER";

export interface Patient {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  date_of_birth: string;
  gender: Gender;
}

export interface SlotRule {
  id: number;
  /** 0 = Monday. Exactly one of weekday / date is set. */
  weekday: number | null;
  date: string | null;
  start_time: string;
  end_time: string;
  capacity: number;
}

export interface Slot {
  /** ISO time in the centre's local time (+05:30). */
  start: string;
  capacity: number;
  booked: number;
  remaining: number;
  bookable: boolean;
}

export interface DaySlots {
  date: string;
  source: "weekly" | "override";
  slots: Slot[];
}

export interface LabSettings {
  id: number;
  name: string;
  transaction_fee_percent: string;
}
