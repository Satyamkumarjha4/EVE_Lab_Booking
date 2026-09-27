import type { FailureReason, PaymentMethod } from "./types";

interface ReasonMeta {
  label: string;
  /** What the patient can do about it. */
  hint: string;
  methods: PaymentMethod[];
}

/** Decline reasons a bank or UPI app can report, with a diagnosis the patient can act on. */
export const FAILURE_REASONS: Record<FailureReason, ReasonMeta> = {
  INSUFFICIENT_FUNDS: {
    label: "Insufficient funds",
    hint: "Top up the account or pay with a different card or UPI app.",
    methods: ["CARD", "UPI"],
  },
  CARD_DECLINED: {
    label: "Declined by the issuing bank",
    hint: "The bank refused the charge. Try another card, or ask the bank to allow it.",
    methods: ["CARD"],
  },
  INCORRECT_PIN: {
    label: "Incorrect PIN or OTP",
    hint: "The PIN or one-time password didn't match. Try again carefully.",
    methods: ["CARD", "UPI"],
  },
  AUTHENTICATION_FAILED: {
    label: "Authentication not completed",
    hint: "The bank's verification step was closed or skipped. Complete it next time.",
    methods: ["CARD", "UPI"],
  },
  BANK_UNAVAILABLE: {
    label: "Bank server unavailable",
    hint: "The bank had a temporary outage. Wait a few minutes and try again.",
    methods: ["CARD", "UPI"],
  },
  TIMED_OUT: {
    label: "Payment request timed out",
    hint: "The request wasn't approved in time. Keep the UPI app open and approve promptly.",
    methods: ["UPI"],
  },
};

export function reasonsFor(method: PaymentMethod) {
  return (Object.keys(FAILURE_REASONS) as FailureReason[]).filter((reason) =>
    FAILURE_REASONS[reason].methods.includes(method)
  );
}
