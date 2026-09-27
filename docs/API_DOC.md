# API Documentation

A per-endpoint reference for every route this backend exposes. For the full generated
OpenAPI 3 schema (exact field types, all enum values) use Swagger UI instead — this doc is
a readable companion to it, not a replacement.

- **Swagger UI:** `GET /api/schema/swagger-ui/` (public, no login needed)
- **Raw schema:** `GET /api/schema/`
- **Base URL (local):** `http://localhost:8000`

All request/response bodies are JSON. Authenticated endpoints expect
`Authorization: Bearer <access token>` (obtained from `/auth/login/`).

**Status code conventions used throughout:** `400` validation error · `401` missing/invalid
token · `403` your role may not do this · `404` doesn't exist *or* is outside your scope ·
`409` the resource's current state doesn't allow this action · `429` rate limited.

**Roles:** `CLIENT` (patient), `CENTRE` (desk staff at one diagnostic centre), `LAB` (owns
one or more centres), `PLATFORM_ADMIN` (Django admin/superuser only — not a business actor,
has no special API access beyond `/admin/`).

---

## Auth (`/auth/`)

### `POST /auth/signup/`
- **Auth:** public. **Throttle:** `auth` (5/min).
- Creates a `CLIENT` account. Any `role` in the body is ignored — signup can never create
  staff accounts.
- **Body:** `{"email": "patient@example.com", "password": "a-strong-passw0rd"}`
- **201:** `{"id": 31, "email": "patient@example.com"}`
- **400:** email already registered, or password fails Django's validators (too short,
  too common, too similar to the email, all-numeric).

### `POST /auth/login/`
- **Auth:** public. **Throttle:** `auth` (5/min).
- **Body:** `{"email": "...", "password": "..."}`
- **200:** `{"access": "<jwt>", "refresh": "<jwt>"}` (access token: 15 min; refresh: 7 days)
- **401:** wrong credentials.
- **429:** more than 5 attempts/min from the same client — the counter uses the real remote
  IP, not a client-supplied `X-Forwarded-For`, so it can't be reset by spoofing that header.

### `POST /auth/refresh/`
- **Auth:** public (the refresh token itself is the credential). **Throttle:** `default`.
- **Body:** `{"refresh": "<jwt>"}` → **200:** `{"access": "<jwt>"}`
- **401:** expired/invalid/blacklisted refresh token.

### `GET /auth/me/`
- **Auth:** any authenticated user.
- **200:** `{"id": 17, "email": "client@demo.eve", "role": "CLIENT", "lab": null, "centre": null}`

---

## Patients (`/patients/`)

### `GET /patients/lookup/?email=`
- **Auth:** `CENTRE` or `LAB`. **Throttle:** `patient_lookup` (20/min — tighter than
  `default` because this returns another person's PII).
- Finds an existing patient (`CLIENT` account) before booking a walk-in. Intentionally
  platform-wide: any centre/lab can look up any patient, since a walk-in may never have
  visited that centre before. Case-insensitive email match; staff accounts are never
  returned even if the email matches one.
- **200:** `{"id": 17, "email": "client@demo.eve", "first_name": "Riya", "last_name": "Sharma", "full_name": "Riya Sharma", "phone": "+91 98100 10000", "date_of_birth": "1992-06-18", "gender": "FEMALE"}`
- **400:** `email` query param missing.
- **403:** caller isn't `CENTRE`/`LAB`.
- **404:** `{"detail": "Patient not found."}` — no match, or the match is staff.

### `POST /patients/`
- **Auth:** `CENTRE` or `LAB`. **Throttle:** `default`.
- Registers a walk-in patient as a `CLIENT` account with no usable password (they haven't
  chosen one yet).
- **Body:** `{"email": "asha.rao@example.com", "first_name": "Asha", "last_name": "Rao", "phone": "+91 98765 43210", "date_of_birth": "1990-04-12", "gender": "FEMALE"}`
  (`gender` ∈ `MALE|FEMALE|OTHER`; `phone` must match `^\+?[0-9 ]{7,20}$`; `date_of_birth`
  can't be in the future)
- **201:** the created patient, same shape as the lookup response.
- **400:** email already registered (look it up instead), or a field fails validation.
- **403:** caller isn't `CENTRE`/`LAB`.

---

## Catalog (`/centres/`, `/labs/`, `/tests/`)

### `GET /centres/`
- **Auth:** public. **Throttle:** `default`. Cached.
- Lists diagnostic centres. A logged-in `CENTRE` user sees only its own centre.
- **200:** `[{"id": 2, "name": "Apollo Diagnostics - Connaught Place", "location": "Connaught Place, Delhi", "lab": {"id": 1, "name": "Apollo Diagnostics", "transaction_fee_percent": "5.00"}}, ...]`

### `POST /centres/`
- **Auth:** `LAB`. **Throttle:** `default`.
- Creates a centre under the caller's own lab (the `lab` is taken from the caller, not the body).
- **Body:** `{"name": "Apollo - Rohini", "location": "Rohini, Delhi"}`
- **201:** the created centre.
- **403:** caller isn't `LAB`, or has no `lab_id`.

### `PATCH /centres/{id}/`
- **Auth:** `LAB` (owner of that centre's lab only). **Throttle:** `default`.
- **Body:** any of `{"name": ..., "location": ...}`
- **200:** the updated centre. **403:** not this lab's centre. **404:** no such centre.

### `GET /centres/{id}/tests/`
- **Auth:** public. **Throttle:** `default`. Cached.
- Lists this centre's active test offerings with centre-specific prices.
  `?include_inactive=true` also returns deactivated ones, but only for that centre's own
  `CENTRE`/`LAB` manager — ignored (treated as active-only) for anyone else.
- **200:** `[{"id": 10, "price": "154.67", "is_active": true, "test": {"id": 18, "name": "Blood Grouping & Rh Typing", "description": "..."}}]`

### `POST /centres/{id}/tests/`
- **Auth:** `LAB` (own centre only). **Throttle:** `default`.
- Offers a test from the global catalog at a centre-specific price. Only labs set prices —
  centres cannot create these.
- **Body:** `{"test": 18, "price": "154.67", "is_active": true}`
- **201:** the created `CentreTest`. **403:** not this lab's centre.

### `PATCH /centres/{id}/tests/{centre_test_id}/`
- **Auth:** `LAB` (own centre, any field) or `CENTRE` (own centre, `is_active` only).
  **Throttle:** `default`.
- **Body:** `{"price": "160.00"}` and/or `{"is_active": false}`
- **200:** the updated `CentreTest`. **403:** a `CENTRE` account sending `price` (labs only
  control pricing), or a caller outside this centre.

### `GET·PATCH /labs/mine/`
- **Auth:** `LAB`. **Throttle:** `default`.
- The caller's own lab's `transaction_fee_percent` (0–100), kept by the lab on a patient's
  paid-booking cancellation or no-show.
- **PATCH body:** `{"transaction_fee_percent": "5.00"}`
- **200:** `{"id": 1, "name": "Apollo Diagnostics", "transaction_fee_percent": "5.00"}`

### `GET /tests/`
- **Auth:** public. **Throttle:** `default`.
- The global test catalog (curated by the platform admin, not per-centre).
- **200:** `[{"id": 12, "name": "Chest X-Ray", "description": "Imaging of the lungs and chest cavity."}, ...]`

---

## Scheduling (`/centres/{id}/slots/`, `/centres/{id}/slot-rules/`)

### `GET /centres/{id}/slots/?from=&days=`
- **Auth:** public. **Throttle:** `default`.
- Every 30-minute slot for `?days=` days (≤31, default 1) starting `?from=` (default today),
  in the centre's local time zone (`Asia/Kolkata`), with capacity/booked/remaining and
  whether it's currently bookable (respects the client booking lead time and the payment
  window). A different centre's `CENTRE` user gets a **404** here (not 403), so centre ids
  can't be probed for existence by role.
- **200:** `[{"date": "2026-09-28", "source": "weekly", "slots": [{"start": "2026-09-28T07:00:00+05:30", "capacity": 4, "booked": 0, "remaining": 4, "bookable": true}, ...]}]`

### `GET·POST /centres/{id}/slot-rules/`
- **Auth:** read — `CENTRE` (own) or `LAB` (own centres, read-only); write — `CENTRE` (own)
  only. Labs can see but never edit slot rules. **Throttle:** `default`.
- A rule sets seats-per-slot for either a recurring `weekday` or a one-off `date` override
  (which replaces that day's weekly rule). Start/end times must land on 30-minute
  boundaries and can't overlap another rule for the same day.
- **POST body:** `{"weekday": 1, "start_time": "09:00", "end_time": "17:00", "capacity": 4}`
  or `{"date": "2026-10-02", "start_time": "09:00", "end_time": "13:00", "capacity": 2}`
- **201:** the created rule. **400:** misaligned times, `end <= start`, both/neither of
  `weekday`/`date` set, or an overlap. **403:** a `LAB` trying to write, or wrong centre.

### `PATCH·DELETE /centres/{id}/slot-rules/{rule_id}/`
- **Auth:** `CENTRE` (own) only. **Throttle:** `default`.
- **200 / 204** on success. **403 / 404** as above.

---

## Bookings (`/bookings/`)

### `POST /bookings/`
- **Auth:** `CLIENT` (books for self) or `CENTRE` (walk-in, own centre only).
  **Throttle:** `default`.
- Starts a booking as `PENDING`. `appointment_at` must land on a free, bookable slot — 400
  if it's misaligned/outside opening hours/too soon (clients need ≥60 min lead time; centre
  walk-ins are exempt), 409 if the slot is full. `amount` is copied from the centre's
  current price for that test.
- **Body (client):** `{"centre_test": 10, "appointment_at": "2026-09-28T07:00:00+05:30"}`
- **Body (centre, walk-in):** adds `"patient": 17` (a patient id from `/patients/lookup/`
  or `/patients/`)
- **201:** the created booking (see shape below).
- **400:** inactive test, misaligned/too-soon/closed slot, or (client) a `patient` field
  present, or (centre) a missing `patient` field.
- **409:** slot is full.

### `GET /bookings/`
- **Auth:** any role. **Throttle:** `default`.
- Scoped by role: `CLIENT` → own bookings; `LAB` → all bookings across its centres;
  `CENTRE` → its own centre's bookings; `PLATFORM_ADMIN` → all. Newest first.
- **200:** `[{"id": 3181, "client": 17, "patient": {"id": 17, "email": "client@demo.eve", "full_name": "Riya Sharma", "phone": "..."}, "centre_test": {...}, "appointment_at": "...", "amount": "154.67", "status": "PENDING", "payment": null, "cancellation": null, "events": [{"status": "PENDING", "actor_role": "CLIENT", "note": "", "created_at": "..."}], "created_at": "...", "updated_at": "..."}, ...]`

### `GET /bookings/{id}/`
- **Auth:** any role, same scoping as the list. **Throttle:** `default`.
- **200:** a single booking, same shape as above. **404:** doesn't exist or is outside your
  scope (deliberately indistinguishable, so ids can't be probed).

### `POST /bookings/{id}/cancel/`
- **Auth:** `CLIENT` (own) or `LAB` (own centres) — `CENTRE` **cannot** cancel.
  **Throttle:** `default`.
- Only `PENDING`/`CONFIRMED` bookings, before the appointment. A paid booking is refunded:
  in full if the lab cancels, minus the lab's `transaction_fee_percent` if the patient does.
- **Body:** `{"reason": "Changed my mind"}`
- **200:** the updated (now `CANCELLED`) booking. **403:** wrong role/not yours. **409:**
  already resolved/cancelled/past its appointment.

### `POST /bookings/{id}/complete/`
- **Auth:** `CENTRE` (own) or `LAB` (own centres). **Throttle:** `default`.
- `CONFIRMED → COMPLETED`, only from the appointment day onward.
- **200:** the updated booking. **403 / 409** as above.

### `POST /bookings/{id}/deliver-report/`
- **Auth:** `CENTRE` (own) or `LAB` (own centres). **Throttle:** `default`.
- `COMPLETED → REPORT_DELIVERED`. Purely a status transition — no file is generated or
  attached anywhere in this API.
- **200:** the updated booking. **403 / 409** as above.

**Booking lifecycle:** `PENDING → CONFIRMED → COMPLETED → REPORT_DELIVERED`, plus
`FAILED`, `CANCELLED`, `NO_SHOW`. An unpaid booking auto-expires (frees its seat) 30 min
after creation; a `CONFIRMED` one becomes `NO_SHOW` 2 h after the slot if nobody marked it
done — both via Celery beat sweeps, not an API call.

---

## Payments (`/payments/`)

### `POST /payments/orders/`
- **Auth:** `CLIENT`/`CENTRE` owning the booking. **Throttle:** `payments` (20/min).
- Opens an `INITIATED` payment order against a `PENDING` booking. Calling this again for
  the same booking returns the existing order instead of creating a second one.
- **Body:** `{"booking": 3181, "method": "CARD"}` (`method` ∈ `CARD|UPI`)
- **201** (new) or **200** (resumed existing order): `{"id": 2966, "reference": "f8f9fbc8-...", "booking": 3181, "amount": "154.67", "method": "CARD", "status": "INITIATED", "refund_status": "NONE", "failure_reason": "", "refund_amount": "0.00", "fee_amount": "0.00", "created_at": "...", "updated_at": "..."}`
- **400:** booking not owned by caller (reads as "does not exist" via the scoped
  queryset, so ids can't be probed), not `PENDING`, or wrong role.

### `POST /payments/`
- **Auth:** `CLIENT`/`CENTRE` owning the payment. **Throttle:** `payments` (20/min).
- Assignment-mandated simulate endpoint: synchronously resolves an `INITIATED` payment to
  `SUCCESS`/`FAILED`, updates the booking, then enqueues the simulated provider webhook
  (2–8 s delay).
- **Body:** `{"payment_reference": "f8f9fbc8-...", "outcome": "SUCCESS"}` or
  `{"payment_reference": "...", "outcome": "FAILED", "failure_reason": "INSUFFICIENT_FUNDS"}`
  (`failure_reason` only valid with `FAILED`; defaults to `CARD_DECLINED`)
- **200:** the resolved payment.
- **404:** unknown reference, *or* a reference that exists but isn't the caller's — both
  read identically, so a reference can't be confirmed to exist by an unrelated caller.
- **409:** payment already resolved, or its booking is no longer `PENDING`.

### `POST /payments/webhook/`
- **Auth:** none (no JWT) — a shared-secret **HMAC-SHA256 signature** of the raw request
  body instead, in `X-Webhook-Signature`, verified with a constant-time comparison.
  **Throttle:** `webhook` (120/min, roomier since every call comes from the same
  internal caller).
- Simulates the provider's async confirmation. Idempotent on `event_id`: a genuine
  redelivery is acknowledged as a no-op. A redelivery that reuses an `event_id` but carries
  a *different* payload than the original (only possible if the shared secret has leaked)
  is still a no-op for booking state, but is logged as a distinct warning rather than being
  silently indistinguishable from an ordinary duplicate. An event that contradicts an
  already-resolved payment (e.g. a stale retry) is logged and ignored — the earlier result
  stays authoritative.
- **Body:** `{"event_id": "<uuid>", "payment_reference": "<uuid>", "status": "SUCCESS"}`
- **200:** `{"detail": "Event processed."}` or `{"detail": "Duplicate event, already processed."}`
- **403:** missing/invalid signature. **404:** unknown `payment_reference`.

---

## Health & schema

### `GET /api/health/`
- **Auth:** none. Checks the database (`SELECT 1`) and Redis.
- **200:** `{"status": "ok", "checks": {"database": true, "redis": true}}`
- **503:** either check failed.

### `GET /api/schema/` · `GET /api/schema/swagger-ui/`
- **Auth:** none — deliberately public for reviewer convenience (see the README's
  Security notes). Exposes endpoint shapes only, never data or secrets.

### `GET /admin/`
- Django's own session-based admin, entirely separate from the JWT API (a Bearer token
  grants no access here). Not part of the REST API; not documented further here.
