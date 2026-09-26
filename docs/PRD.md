# Product Requirements Document — EVE Diagnostics Booking Platform

## 1. Context

This is a hiring assignment for EVE Healthcare (SDE Intern — Backend Engineering). The brief
specifies a small backend service (diagnostic test bookings + simulated payments), estimated at
3–4 hours, with a list of optional bonus items.

We are treating this as a **~10–12 hour portfolio-grade submission**: the backend is the graded
deliverable and must be complete, correct, and well-tested; the frontend is a minimal add-on built
*after* the backend is solid, to demonstrate integration ability and UX sense (brownie points, not
graded criteria).

Bonus items required from day one (not deferred): **Redis, Celery, Docker/docker-compose, Swagger,
tests**. Bonus items explicitly deferred to "later, if time permits": **structured logging,
pagination, retry handling for webhook processing**. These are noted as call-outs in the
architecture doc so the seams exist even if unimplemented.

## 2. Actors & Hierarchy

The platform models a real diagnostics-aggregator hierarchy (Tata 1mg / Apollo 247 / PharmEasy
style):

```
Platform (EVE)
 └── Lab            (organization that owns one or more centres; has login)
      └── Centre     (physical diagnostic centre; has login, no cancellation rights)
           └── (serves) Client / Patient  (end user; has login, books tests)
```

- **Platform Admin** — superuser, not a primary actor for this assignment but modeled as a role for
  completeness (Django superuser / `is_staff`).
- **Lab** — owns centres, can view and **cancel** any booking made at any of its centres, can manage
  its centres' test catalogs.
- **Centre** — physical location, offers tests at a price, can **view** its bookings but **cannot
  cancel** them (cancellation is a Lab/Client-level decision, not a centre-level one — mirrors real
  franchise/aggregator setups where the centre is an operational fulfiller, not the account owner).
- **Client / Patient** — signs up, browses centres/tests, books, pays (simulated), can **cancel**
  their own booking.

All four roles authenticate through the same JWT endpoints, differentiated by a `role` field on the
user record.

## 3. Core User Stories

### Client
- Sign up / log in.
- Browse diagnostic centres and the tests they offer, with prices.
- Book a test at a centre for a given date/time.
- Pay for the booking via a simulated payment (card details or UPI-style QR flow).
- View booking status transition from PENDING → CONFIRMED/FAILED.
- Cancel their own booking (before it is fulfilled).

### Lab
- Log in.
- View all bookings across all centres under the lab.
- Cancel any booking under the lab (simulated refund triggered if already paid).
- Manage (create/update) centres and the tests+prices they offer.

### Centre
- Log in.
- View bookings scheduled at the centre (read-only).

### Platform / System
- Simulate a payment outcome (SUCCESS/FAILED) at runtime, driven by a manual "customer" choice in
  the payment simulation UI, not a random dice roll.
- Receive a webhook event asserting the final payment status, applied **idempotently**.
- Keep booking state consistent even under duplicate/out-of-order webhook delivery.

## 4. Booking Lifecycle

```
PENDING → (payment success)  → CONFIRMED
PENDING → (payment failure)  → FAILED
PENDING/CONFIRMED → (cancel by Client or Lab) → CANCELLED
```

- A booking is created in `PENDING` state before any payment attempt exists.
- Only `PENDING` bookings can have a payment order created against them.
- `CONFIRMED` bookings can still be cancelled (triggers a simulated refund on the payment).
- `FAILED` and `CANCELLED` are terminal; a new booking must be created to retry.
- Centre cannot transition booking state at all (read-only role).

## 5. Payment Simulation UX (product-level requirement)

We are not integrating a real gateway, but we want the *flow* to feel real for demo purposes:

1. Client hits "Pay" on a PENDING booking → backend creates an **Order** (unique reference,
   `INITIATED` state) tied to the booking.
2. Frontend shows a mock checkout screen with two tabs: **Card** (dummy form, no real validation of
   card networks) and **UPI** (a rendered QR placeholder + UPI ID string).
3. Instead of trying to detect a real scan (impossible without a real PSP), the UI simulates the
   "customer's phone" step explicitly: after the user "submits" card details or "clicks" the QR, the
   UI reveals two buttons — **Simulate Success** / **Simulate Failure** — standing in for what would
   normally happen on the customer's UPI app / bank OTP screen.
4. Clicking one of these calls the assignment-mandated `POST /payments/` endpoint with the chosen
   outcome, which synchronously marks the **Payment** SUCCESS/FAILED.
5. A Celery task is enqueued to asynchronously deliver a **webhook event** to
   `POST /payments/webhook/` a few seconds later, mimicking a real provider's async callback. This is
   the event the idempotency requirement is built around — it is expected/allowed to arrive after
   the synchronous result, and possibly more than once (simulated by allowing the same task to be
   re-dispatched in tests).
6. The booking status updates only via the code path that both the synchronous payment result and
   the webhook event share (see Architecture doc §5), so double-delivery cannot double-apply state.

## 6. Non-Goals

- No real payment gateway integration.
- No real SMS/email delivery (notification is a logged/simulated Celery task).
- No structured logging, pagination, or webhook retry/backoff — deferred (see §1).
- No multi-tenant billing, KYC, or real card storage — all payment data is fake/dummy by design.

## 7. Success Criteria (mapped to assignment rubric)

| Rubric area | How this PRD addresses it |
|---|---|
| API/backend design | Clear role hierarchy, REST resources per entity, documented in Architecture doc |
| Database design | Normalized hierarchy + through-table pricing, see ER doc |
| Edge-case handling | Idempotent webhook, permission matrix, terminal state guards |
| Tests | Unit + integration tests planned per phase (Phases doc) |
| Bonus engineering | Redis, Celery, Docker, Swagger, tests included from Phase 1 onward |

## 8. Assumptions

- "Lab" and "Centre" login are just another `role` on the same `User`/auth system, not a separate
  auth stack — simplest correct design given time budget.
- A Centre can belong to exactly one Lab (no shared/franchise centres across labs).
- A Client has no centre/lab affiliation — they book against any centre in the catalog.
- Test pricing is **per centre**, not global (a "Complete Blood Count" test can cost differently at
  two different centres) — see ER doc §2 for the `CentreTest` join table.
