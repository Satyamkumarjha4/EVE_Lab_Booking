# Architecture & Technical Design Doc

## 1. Tech Stack

| Concern | Choice | Notes |
|---|---|---|
| Backend framework | Django + Django REST Framework | assignment allows Django/FastAPI/Flask; Django chosen for ORM + admin + batteries |
| Database | PostgreSQL | dockerized, per assignment preference |
| Auth | JWT via `djangorestframework-simplejwt` | access + refresh pair |
| Background jobs | Celery | webhook-delivery simulation, notifications, cleanup |
| Broker/result backend & cache | Redis | single Redis instance, separate logical DB indices for cache vs. Celery |
| API docs | `drf-spectacular` (OpenAPI 3 / Swagger UI) | auto-generated from serializers/views |
| Testing | `pytest` + `pytest-django` + DRF `APIClient` | unit + integration |
| Containerization | Docker + docker-compose | services: `web`, `db`, `redis`, `celery-worker`, `celery-beat` (optional) |
| Rate limiting | DRF throttling classes | scoped throttles per endpoint group |

Deferred (explicitly out of scope, noted as future work in README): structured logging (stdlib
logging with basic config only), pagination (endpoints return full lists — acceptable at this
data scale), webhook retry/backoff (idempotency is handled; automatic retry-with-backoff on
delivery failure is not).

## 2. Actors & Auth Model

Single custom `User` model (`AbstractUser` subclass) with:

- `role`: enum `PLATFORM_ADMIN | LAB | CENTRE | CLIENT`
- `lab` FK (nullable — set when `role == LAB`)
- `centre` FK (nullable — set when `role == CENTRE`)

Rationale: one JWT auth stack for everyone is simpler and still correctly models "Lab and Centre
have logins too" — role-based permission classes do the rest. A separate auth system per actor type
would triple the auth surface for no functional gain at this scope.

Note: the permission matrix below reflects the actual implementation, which now lets a **Centre**
create and pay for bookings on its own behalf (e.g. walk-in patients registered by centre staff),
and removes blanket booking-management rights from **Platform Admin** (admin is auth/superuser
only — it does not act as a business actor in the booking flow). Cancellation stays restricted to
**Client (own)** and **Lab (own centres)** only.

JWT: access token short-lived (~15 min), refresh token longer-lived (~7 days), rotation not
required for this scope but noted as a natural extension. Standard `/auth/signup/`, `/auth/login/`,
`/auth/refresh/` endpoints.

### Permission matrix

| Action | Client | Lab | Centre | Platform Admin |
|---|---|---|---|---|
| Browse centres/tests | ✅ | ✅ | ✅ (own) | ✅ |
| Create booking | ✅ (self) | ❌ | ✅ (own) | ❌ |
| Cancel booking | ✅ (own) | ✅ (own centres' bookings) | ❌ | ❌ |
| View bookings | own only | own centres' | own centre's | all |
| Manage centre/test catalog | ❌ | ✅ (own centres) | ✅ (own) | ✅ |
| Trigger payment | ✅ (own booking) | ❌ | ✅ (own) | ❌ |
| Receive webhook | n/a (system-to-system, no user auth — see §5.3) | | | |

## 3. Domain Model Summary

See `docs/ER_DIAGRAM.md` for the full diagram. Entities: `Lab`, `Centre`, `Test`, `CentreTest`
(through table with price), `User`, `Booking`, `Payment`, `PaymentEvent`.

Key design choice: **tests are a global catalog, pricing is per-centre.** `CentreTest` carries
`price` so the same logical test (e.g. "Lipid Profile") can be priced differently across centres,
matching how 1mg/Apollo247 display "same test, different price, different lab."

## 4. Booking API Surface (indicative)

```
POST   /auth/signup/
POST   /auth/login/
POST   /auth/refresh/

GET    /centres/                      list centres (+ nested/queryable tests)
GET    /centres/{id}/tests/           tests + price at a centre

POST   /bookings/                     create booking (client, own; or centre, own) — PENDING
GET    /bookings/                     role-scoped list
GET    /bookings/{id}/
POST   /bookings/{id}/cancel/         client (own) or lab (own centres) only

POST   /payments/orders/              create Order against a PENDING booking
POST   /payments/                     simulate outcome for an order (SUCCESS|FAILED) — client or centre (own) — per assignment spec
POST   /payments/webhook/             provider callback, idempotent — per assignment spec
```

`POST /payments/` and `POST /payments/webhook/` are named exactly as the assignment specifies since
they are graded contract points; `/payments/orders/` is an addition to support the "order
generation, then payment" flow described in the product requirement.

## 5. Payment & Webhook Design

### 5.1 Models

- **Payment** (aka Order): `id`, `reference` (UUID, unique — the client-facing "order id"),
  `booking` FK, `amount`, `method` (`CARD|UPI`), `status`
  (`INITIATED|SUCCESS|FAILED`), timestamps.
- **PaymentEvent**: `event_id` (UUID, **unique** — this is the idempotency key), `payment` FK,
  `status` (`SUCCESS|FAILED`), `raw_payload` (JSON), `processed_at`, `created_at`.

Two different keys exist on purpose:
- `Payment.reference` identifies the *payment attempt* (what `POST /payments/` targets).
- `PaymentEvent.event_id` identifies one *delivery* of a status update (what the webhook receives).
  A real provider can send the same event_id twice (retry) — that's the case idempotency guards.

### 5.2 Synchronous simulate endpoint — `POST /payments/`

Request: `{ "payment_reference": "...", "outcome": "SUCCESS" | "FAILED" }` (outcome chosen by the
user in the UI simulation, see PRD §5).

Behavior:
1. Look up `Payment` by reference; 404 if not found, 409 if not `INITIATED` (already resolved —
   prevents re-submitting a resolved payment).
2. Set `Payment.status` immediately (this is what makes the demo feel real-time in the UI).
3. Update `Booking.status` (`CONFIRMED` on SUCCESS, `FAILED` on FAILED) via the **shared
   state-transition function** described in §5.4.
4. Enqueue a Celery task (`deliver_payment_webhook.delay(...)`, with a short randomized delay, e.g.
   2–8s) that POSTs an event to `/payments/webhook/` with a fresh `event_id`, simulating the
   provider's async confirmation of the same outcome.

### 5.3 Webhook — `POST /payments/webhook/`

No user JWT (this is a system-to-system endpoint in real life) — instead protected by a shared
secret header (`X-Webhook-Signature`, HMAC over the payload with a secret from settings), which
also gives us a legitimate reason to reject malformed/unsigned calls as an edge case.

Request: `{ "event_id": "...", "payment_reference": "...", "status": "SUCCESS"|"FAILED" }`

Idempotency algorithm:
1. `INSERT PaymentEvent(event_id=..., ...)` inside a transaction, relying on the **unique
   constraint on `event_id`** — if it violates uniqueness (duplicate delivery), catch the
   `IntegrityError` and return `200 OK` immediately without touching `Payment`/`Booking` again. This
   is the core idempotency guarantee: it's enforced at the DB constraint level, not just
   application-level "check then act" (which would race under concurrent duplicate delivery).
2. If the insert succeeds (first time seeing this `event_id`), look up the `Payment` by
   `payment_reference`. If already resolved to the *same* status the event reports, no-op (state
   already correct, e.g. sync path beat the webhook). If resolved to a *different* status than the
   event claims — log a conflict and keep the earlier (synchronous) result as authoritative, since
   that came directly from the user-simulated action; do not flip a CONFIRMED booking to FAILED
   from a stale/out-of-order event.
3. If `Payment` is still `INITIATED` (webhook arrived before/without a sync call — also a valid
   path, e.g. testing the webhook directly per assignment's edge-case list), apply the transition
   via §5.4.

### 5.4 Shared state-transition function

Both call sites (sync `/payments/` and the webhook) funnel through one function,
`apply_payment_result(payment, status)`, wrapped in `select_for_update()` on the `Payment` row. This
guarantees:
- No duplicate booking creation (booking already exists before payment starts).
- No duplicate payment records (one `Payment` per booking's active attempt).
- No corrupted booking state from racing sync + async paths — whichever gets the row lock first
  wins, second call sees the already-updated state and short-circuits.

### 5.5 Cancellation & simulated refund

`POST /bookings/{id}/cancel/`:
- If `Payment.status == SUCCESS`, set a `refund_status = SIMULATED_REFUNDED` on the payment (no real
  money movement, just a state flag + Celery task to "notify" — demonstrates the refund concept
  without building a second payment rail).
- Booking → `CANCELLED` regardless of prior state (except from another terminal state, which is
  rejected with 409).

## 6. Redis Usage

1. **Celery broker + result backend** (`redis://redis:6379/0`).
2. **Read-through cache** for `GET /centres/` and `GET /centres/{id}/tests/` (catalog data changes
   rarely) — cache key includes query params, TTL ~60s, invalidated on Lab catalog writes.

## 7. Rate Limiting

DRF `ScopedRateThrottle`:
- `auth` scope (signup/login): tighter (e.g. 5/min) — brute-force protection.
- `payments` scope (`/payments/`, `/payments/webhook/`): moderate (e.g. 20/min) — abuse protection
  without blocking the webhook simulation's retries.
- default scope: generous (e.g. 100/min) for read endpoints.

## 8. Docker Compose Topology

```
services:
  db:            postgres:16
  redis:         redis:7
  web:           Django + gunicorn (or runserver for dev), depends_on db, redis
  celery-worker: same image as web, `celery -A eve worker`
  celery-beat:   (optional, only if we add a scheduled cleanup job for stale PENDING bookings)
```

## 9. Testing Strategy

- **Unit**: model validation/state machine (`Booking`, `Payment` transitions), permission classes.
- **Integration**: full request/response cycles for signup→login→browse→book→pay→webhook, including
  the duplicate-webhook idempotency case explicitly (assignment's headline edge case).
- **Edge cases to explicitly test**: invalid booking id, cancel-after-terminal-state, unauthorized
  cancel attempt (client trying to cancel someone else's booking; centre trying to cancel at all),
  duplicate webhook event_id, webhook with unknown payment_reference, payment simulate on an
  already-resolved payment.

## 10. What's deferred and why

| Bonus item | Status | Reasoning |
|---|---|---|
| Redis | ✅ from Phase 1 | required per user decision |
| Celery | ✅ from Phase 1 | core to the payment/webhook design itself |
| Docker/compose | ✅ from Phase 1 | required per user decision |
| Swagger | ✅ from Phase 1 | required per user decision |
| Tests | ✅ ongoing per phase | required per user decision |
| Structured logging | ❌ deferred | stdlib logging only for now; noted as future work in README |
| Pagination | ❌ deferred | dataset small enough for full-list responses at this scope |
| Webhook retry/backoff | ❌ deferred | idempotency solved; automatic redelivery-on-failure is a separate concern, noted as future work |
