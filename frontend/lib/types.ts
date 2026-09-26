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

export type BookingStatus = "PENDING" | "CONFIRMED" | "FAILED" | "CANCELLED";

export interface BookingCentreTest {
  id: number;
  centre: Centre;
  test: Test;
  price: string;
}

// Shape returned by POST /bookings/ (centre_test is a plain id here, unlike the list/detail
// serializer which nests it).
export interface CreatedBooking {
  id: number;
  client: number | null;
  centre_test: number;
  appointment_at: string;
  amount: string;
  status: BookingStatus;
  created_at: string;
}

export interface Booking {
  id: number;
  client: number | null;
  centre_test: BookingCentreTest;
  appointment_at: string;
  amount: string;
  status: BookingStatus;
  created_at: string;
  updated_at: string;
}

export type PaymentMethod = "CARD" | "UPI";
export type PaymentStatus = "INITIATED" | "SUCCESS" | "FAILED";
export type RefundStatus = "NONE" | "SIMULATED_REFUNDED";

export interface Payment {
  id: number;
  reference: string;
  booking: number;
  amount: string;
  method: PaymentMethod;
  status: PaymentStatus;
  refund_status?: RefundStatus;
  created_at: string;
  updated_at?: string;
}
