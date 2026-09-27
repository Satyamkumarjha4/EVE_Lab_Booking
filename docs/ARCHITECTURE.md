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
| Create booking | ✅ (self) | ❌ | ✅ (own centre, for a named patient) | ❌ |
| Look up / register walk-in patients | ❌ | ✅ | ✅ | ❌ |
| Cancel booking (before the appointment, with a reason) | ✅ (own) | ✅ (own centres' bookings) | ❌ | ❌ |
| Mark test completed / report delivered | ❌ | ✅ (own centres) | ✅ (own) | ❌ |
| View bookings | own only | own centres' | own centre's | all |
| Create/edit centres, add tests, set prices | ❌ | ✅ (own lab) | ❌ | ✅ (Django admin; also curates the global `Test` list) |
| Switch a test's availability | ❌ | ✅ (own centres) | ✅ (own) | ✅ (Django admin) |
| Edit slot rules | ❌ | read-only (own centres) | ✅ (own) | ✅ (Django admin) |
| Set the lab's transaction fee % | ❌ | ✅ | ❌ | ✅ (Django admin) |
| Trigger payment | ✅ (own booking) | ❌ | ✅ (own) | ❌ |
| Receive webhook | n/a (system-to-system, no user auth — see §5.3) | | | |

## 3. Domain Model Summary

See `docs/ER_DIAGRAM.md` for the full diagram. Entities: `Lab`, `Centre`, `Test`, `CentreTest`
(through table with price), `User`, `Booking`, `BookingEvent` (status history), `Payment`,
`PaymentEvent`, `SlotRule` (per-centre capacity).

Key design choice: **tests are a global catalog, pricing is per-centre.** `CentreTest` carries
`price` so the same logical test (e.g. "Lipid Profile") can be priced differently across centres,
matching how 1mg/Apollo247 display "same test, different price, different lab."

## 4. Booking API Surface (indicative)

```
POST   /auth/signup/
POST   /auth/login/
POST   /auth/refresh/

GET    /auth/me/

GET    /centres/                      list centres (public; CENTRE login sees own)
POST   /centres/                      lab creates a centre under its own lab
PATCH  /centres/{id}/                 lab (own lab): name, location
GET    /centres/{id}/tests/           active tests + price at a centre (?include_inactive for managers)
POST   /centres/{id}/tests/           lab: offer a global Test at a centre price
PATCH  /centres/{id}/tests/{ct_id}/   lab: price, is_active · centre (own): is_active only
GET    /tests/                        global test catalog
GET    /labs/mine/  PATCH             lab: name, transaction_fee_percent

GET    /centres/{id}/slots/           public: 30-min slots with capacity/booked/remaining (?from, ?days)
GET    /centres/{id}/slot-rules/      centre (own) / lab (own centres, read-only)
POST   /centres/{id}/slot-rules/      centre (own): weekday rule or date override
PATCH|DELETE /centres/{id}/slot-rules/{rule_id}/

GET    /patients/lookup/?email=       centre/lab: find a CLIENT for a walk-in
POST   /patients/                     centre/lab: register a walk-in patient

POST   /bookings/                     client (self) or centre (own, `patient` required) — PENDING;
                                      409 if the slot is full
GET    /bookings/                     role-scoped list (with patient, payment, events)
GET    /bookings/{id}/
POST   /bookings/{id}/cancel/         client (own) or lab (own centres); {reason}; before appointment
POST   /bookings/{id}/complete/       centre (own) / lab: CONFIRMED → COMPLETED
POST   /bookings/{id}/deliver-report/ centre (own) / lab: COMPLETED → REPORT_DELIVERED

POST   /payments/orders/              create (201) or resume (200) the Order of a PENDING booking
POST   /payments/                     simulate outcome for an order (SUCCESS|FAILED) — client or centre (own) — per assignment spec
POST   /payments/webhook/             provider callback, idempotent — per assignment spec
```

`POST /payments/` and `POST /payments/webhook/` are named exactly as the assignment specifies since
they are graded contract points; `/payments/orders/` is an addition to support the "order
generation, then payment" flow described in the product requirement. Order creation is
create-or-resume, so a user who abandons checkout can come back and pay the same order instead of
being stuck with a PENDING booking that can never be paid.

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

As implemented, the event insert (step 1) and the state transition (steps 2–3) run inside **one
outer transaction**, with the insert in a nested savepoint so its `IntegrityError` can be caught.
If processing raises after a successful insert, the event row rolls back as well. Recording the event in its own
transaction first would be subtly wrong: a crash after that commit leaves an event marked as seen but
never applied, and every provider redelivery would then be dismissed as a duplicate. The payment is
looked up by reference before the insert, because `PaymentEvent.payment` is a non-null FK. An
unknown reference returns 404 without recording anything.

### 5.4 Shared state-transition function

Both call sites (sync `/payments/` and the webhook) funnel through one function,
`apply_payment_result(payment, status)`, wrapped in `select_for_update()` on the `Payment` row. This
guarantees:
- No duplicate booking creation (booking already exists before payment starts).
- No duplicate payment records (one `Payment` per booking's active attempt).
- No corrupted booking state from racing sync + async paths — whichever gets the row lock first
  wins, second call sees the already-updated state and short-circuits.

Implementation details that the guarantees depend on:

- **Lock order is Booking row, then Payment row**, in every writer: `apply_payment_result()`,
  `open_payment_order()` (order creation) and `cancel_booking()` (§5.5). Locking only the payment
  wasn't enough, because cancellation writes the *booking*. Without a shared lock, a cancel racing a
  payment could interleave, and a consistent order is what rules out deadlocks.
- It returns `(payment, applied)`. `applied=False` means the payment was already resolved: the sync
  endpoint turns that into a 409 (it lost a race), and the webhook compares statuses to decide
  between a quiet no-op and a logged conflict.
- **It only moves a booking out of `PENDING`.** Before the Phase 7 audit it set CONFIRMED/FAILED
  unconditionally, so a payment resolved after cancellation (an abandoned INITIATED order, then a
  late webhook) resurrected a CANCELLED booking as CONFIRMED. Now a late SUCCESS on a cancelled
  booking is recorded truthfully on the payment and flagged `SIMULATED_REFUNDED`, and the booking
  stays CANCELLED. The sync endpoint rejects paying a non-PENDING booking up front with a 409.

### 5.5 Cancellation, no-shows & simulated refunds

`POST /bookings/{id}/cancel/` takes a required `reason` and is allowed from `PENDING` or `CONFIRMED`,
only before `appointment_at` (409 otherwise). A captured payment is refunded (simulated: a state
change, no second payment rail). The split is snapshotted onto the payment as `refund_amount` +
`fee_amount`:

| Case | Refund |
|---|---|
| Patient cancels a paid booking | amount − lab's `transaction_fee_percent` |
| Lab cancels a paid booking | full amount |
| Patient didn't arrive (`NO_SHOW`) | amount − lab's `transaction_fee_percent` |
| Payment captured after the booking was already cancelled (§5.4) | full amount |

Implemented in `bookings.services` under the same Booking-then-Payment row lock as §5.4, with the
refund math in `payments.services.refund()`. A payment still `INITIATED` at cancel time is left
alone; if it later resolves, §5.4's cancelled-booking branch applies.

### 5.6 Visit lifecycle & scheduled sweeps

```
PENDING ─pay ok─▶ CONFIRMED ("awaiting arrival") ─centre/lab─▶ COMPLETED ─centre/lab─▶ REPORT_DELIVERED
   │  └pay fail─▶ FAILED (+ failure_reason)           │
   └─cancel / payment window expired─▶ CANCELLED ◀─cancel (before appointment)
                                                   └─auto after appointment + 2 h─▶ NO_SHOW
```

Every transition appends a `BookingEvent` (status, actor role, optional actor, note), which is the
booking's history in the UI and where cancellation and decline reasons are kept. Two Celery beat
tasks (`bookings.tasks`, every 5 minutes, `celery-beat` service) drive the time-based transitions,
each booking in its own transaction and re-checked under its row lock through the same services:

- `expire_unpaid_bookings`: PENDING older than `PAYMENT_WINDOW_MINUTES` (30) → CANCELLED ("Payment
  not completed within 30 minutes"). This frees the slot seat an abandoned checkout was holding.
- `mark_no_shows`: CONFIRMED past `appointment_at + NO_SHOW_GRACE_MINUTES` (120) → NO_SHOW, with the
  fee-deducted refund.

### 5.7 Slot capacity

A centre's `SlotRule`s say how many patients fit in each 30-minute slot, per weekday or per date
(date rules replace that weekday's rules for the whole day). Times are the centre's local time
(`CENTRE_TIME_ZONE = Asia/Kolkata`). `bookings.services.create_booking()` locks the **Centre** row
(`SELECT … FOR UPDATE`), checks the slot is aligned, open and has a free seat (seats = bookings in
PENDING/CONFIRMED/COMPLETED/NO_SHOW/REPORT_DELIVERED), then inserts. Two requests racing for the
last seat therefore serialize; the loser gets 409. This lock takes no Booking lock, so it can't
deadlock with the Booking→Payment order above. Patients must book 60 minutes ahead; centre staff
may use any slot that hasn't ended (walk-ins). New centres get a default week (Mon–Sat 07:00–19:00
×4, Sun 08:00–13:00 ×2).

## 6. Redis Usage

1. **Celery broker + result backend** (`redis://redis:6379/0`).
2. **Read-through cache** for `GET /centres/` and `GET /centres/{id}/tests/` (catalog data changes
   rarely) — cache key includes the caller's scope and query params, TTL ~60s, invalidated on
   catalog writes. Invalidation is a `post_save`/`post_delete` signal on `Lab` (its name is embedded
   in centre payloads), `Centre`, `Test` and `CentreTest`. It clears every `centres:*` key
   immediately **and again via `transaction.on_commit`**, because a read that runs while the write's
   transaction is still open sees the old rows and would re-cache them for a full TTL. Signals cover
   every write path (API, Django admin, seed command); queryset `.update()` bypasses them and isn't
   used on catalog models.
3. **Throttle counters** for DRF's rate limiting (§7) live in the same cache DB.

## 7. Rate Limiting

DRF `ScopedRateThrottle`:
- `auth` scope (signup/login): 5/min, for brute-force protection. Token refresh is in `default`:
  refresh tokens are signed and unguessable, so they aren't a brute-force target, and sharing the
  5/min bucket would let routine refreshes lock a user out of logging in.
- `payments` scope (`/payments/orders/`, `/payments/`): 20/min, for abuse protection.
- `webhook` scope (`/payments/webhook/`): 120/min. This changed from the original plan of sharing
  `payments`: every delivery comes from the provider's address (here the celery-worker container),
  so a per-IP bucket sized for one user would start dropping legitimate confirmations at
  20 payments/min system-wide.
- `default` scope: 100/min for everything else user-facing.

Clients are identified by user id when authenticated and by socket address otherwise, with
`NUM_PROXIES = 0`. DRF's default (`None`) uses a client-supplied `X-Forwarded-For` header verbatim
as the identity, so rotating that header would reset the login limit on every request. Behind a
real reverse proxy this should be set to the number of trusted proxies.

## 8. Docker Compose Topology

```
services:
  db:            postgres:16      published on 127.0.0.1 only
  redis:         redis:7          published on 127.0.0.1 only (password-less broker)
  web:           Django runserver (dev), depends_on db, redis
  celery-worker: same image as web, `celery -A eve worker`; calls back to http://web:8000
  celery-beat:   same image, `celery -A eve beat`; schedules the §5.6 sweeps onto the worker
```

Django's `ALLOWED_HOSTS` must include `web`, since that is the Host header on the worker's webhook
calls. Both app containers bind-mount `./backend` with the shared SELinux label `:z` (see
`docs/IMPLEMENTATION.md`).

## 9. Testing Strategy

- **Unit**: model validation/state machine (`Booking`, `Payment` transitions), permission classes.
- **Integration**: full request/response cycles for signup→login→browse→book→pay→webhook, including
  the duplicate-webhook idempotency case explicitly (assignment's headline edge case).
- **Edge cases to explicitly test**: invalid booking id, cancel-after-terminal-state, unauthorized
  cancel attempt (client trying to cancel someone else's booking; centre trying to cancel at all),
  duplicate webhook event_id, webhook with unknown payment_reference, payment simulate on an
  already-resolved payment, cancel after the appointment, fee vs. full refund, full slot (409),
  misaligned/closed slot, no-show grace period, late capture after an expired payment window.

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
