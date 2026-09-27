# Entity-Relationship Diagram

## 1. Diagram

```mermaid
erDiagram
    LAB ||--o{ CENTRE : owns
    CENTRE ||--o{ CENTRE_TEST : offers
    TEST ||--o{ CENTRE_TEST : "priced at"
    CENTRE ||--o{ USER : "has staff login"
    LAB ||--o{ USER : "has staff login"
    USER ||--o{ BOOKING : "books (as CLIENT)"
    CENTRE ||--o{ BOOKING : "fulfilled at"
    CENTRE_TEST ||--o{ BOOKING : "ordered as"
    BOOKING ||--o| PAYMENT : "paid via"
    BOOKING ||--o{ BOOKING_EVENT : "history"
    USER ||--o{ BOOKING_EVENT : "acted (nullable = system)"
    PAYMENT ||--o{ PAYMENT_EVENT : "receives"
    CENTRE ||--o{ SLOT_RULE : "takes bookings per"

    LAB {
        uuid id PK
        string name
        string location
        decimal transaction_fee_percent "0-100, default 5"
        timestamp created_at
    }

    CENTRE {
        uuid id PK
        uuid lab_id FK
        string name
        string location
        timestamp created_at
    }

    TEST {
        uuid id PK
        string name
        string description
        timestamp created_at
    }

    CENTRE_TEST {
        uuid id PK
        uuid centre_id FK
        uuid test_id FK
        decimal price
        boolean is_active
    }

    USER {
        uuid id PK
        string email
        string password_hash
        enum role "PLATFORM_ADMIN | LAB | CENTRE | CLIENT"
        uuid lab_id FK "nullable, set when role=LAB"
        uuid centre_id FK "nullable, set when role=CENTRE"
        string first_name
        string last_name
        string phone "patient details (walk-ins)"
        date date_of_birth "nullable"
        enum gender "MALE | FEMALE | OTHER, blank"
        timestamp created_at
    }

    BOOKING {
        uuid id PK
        uuid client_id FK "USER, role=CLIENT"
        uuid centre_test_id FK
        datetime appointment_at
        decimal amount
        enum status "PENDING | CONFIRMED | FAILED | CANCELLED | COMPLETED | NO_SHOW | REPORT_DELIVERED"
        timestamp created_at
        timestamp updated_at
    }

    BOOKING_EVENT {
        uuid id PK
        uuid booking_id FK
        enum status "the status entered"
        uuid actor_id FK "nullable USER"
        enum actor_role "CLIENT | CENTRE | LAB | PLATFORM_ADMIN | SYSTEM"
        string note "cancellation / failure reason"
        timestamp created_at
    }

    SLOT_RULE {
        uuid id PK
        uuid centre_id FK
        int weekday "0-6, XOR date"
        date date "one-off override, XOR weekday"
        time start_time "30-min aligned, centre local time"
        time end_time
        int capacity "patients per 30-min slot, 0 = closed"
    }

    PAYMENT {
        uuid id PK
        uuid booking_id FK
        uuid reference UK "client-facing order id"
        decimal amount
        enum method "CARD | UPI"
        enum status "INITIATED | SUCCESS | FAILED"
        enum refund_status "NONE | SIMULATED_REFUNDED"
        enum failure_reason "blank | INSUFFICIENT_FUNDS | CARD_DECLINED | ..."
        decimal refund_amount
        decimal fee_amount "refund_amount + fee_amount = amount once refunded"
        timestamp created_at
        timestamp updated_at
    }

    PAYMENT_EVENT {
        uuid id PK
        uuid event_id UK "idempotency key"
        uuid payment_id FK
        enum status "SUCCESS | FAILED"
        json raw_payload
        timestamp processed_at
        timestamp created_at
    }
```

## 2. Notes on key design decisions

- **`CENTRE_TEST` is a first-class through table**, not a plain M2M, because it carries `price` and
  `is_active` — the same `TEST` can exist at multiple centres with different prices, and a centre
  can temporarily deactivate a test without deleting historical bookings that reference it.
- **`BOOKING.centre_test_id`** (not separate `centre_id` + `test_id`) — the price at booking time is
  effectively locked to the `CentreTest` row it points to; `BOOKING.amount` is still stored
  denormalized on the booking at creation time so a later price change at the centre doesn't alter
  historical bookings.
- **`USER.lab_id` / `USER.centre_id`** are both nullable FKs on one table rather than separate
  `LabUser`/`CentreUser` models — keeps the auth/permission code to one model + one JWT flow (see
  Architecture doc §2) while still expressing the 3-level hierarchy.
- **Two separate unique keys around payments** — `PAYMENT.reference` (the order/attempt) vs.
  `PAYMENT_EVENT.event_id` (one webhook delivery) — is the crux of the idempotency design; see
  Architecture doc §5.1 for why they must not be collapsed into one.
- **`BOOKING` ↔ `PAYMENT` is one-to-zero-or-one** in this scope (a booking gets at most one active
  payment attempt at a time — a FAILED payment means the booking is FAILED and a *new* booking must
  be created to retry, per PRD §4). This keeps the state machine simple; multi-attempt retry on the
  same booking is a documented future improvement.
- **PKs are implemented as `BigAutoField` (Django integer PKs), not literal UUIDs** as drawn above —
  the `uuid id PK` notation here is "PK, globally unique" shorthand rather than a literal type
  mandate. Internal consistency won out: the project's other models use `BigAutoField`, and mixing PK
  styles across apps (or across every future FK in later phases) is a bigger footgun than a one-line
  deviation from this diagram. `User` also drops `username` in favor of `email` as the login field
  (`USERNAME_FIELD = "email"`), matching this diagram's `USER.email` (there's no `USER.username`
  drawn above).
- **`BOOKING.client_id` is nullable** only for legacy walk-ins. Centre staff now identify every
  walk-in patient by email (`GET /patients/lookup/`) or register them (`POST /patients/`, a CLIENT
  `USER` with no usable password plus name/phone/DOB/gender), so new walk-ins always point at a
  patient. Visibility for centre and lab is still derived from `centre_test`'s centre.
- **`BOOKING_EVENT` is append-only history**, one row per status change, with who did it
  (`actor_role`, and `actor` unless the system did it) and why (`note`). The cancellation reason and
  payment failure reason live here, so the timeline in the UI is the real record rather than a guess
  from timestamps. `PAYMENT.failure_reason` also keeps the structured decline code for analytics.
- **`SLOT_RULE` holds capacity, not slots.** A rule says "between these times, N patients per
  30-minute slot", either for a weekday or for one date. If any date rules exist for a date they
  replace that weekday's rules entirely (a holiday is one rule with capacity 0). Slots are derived on
  read (`GET /centres/{id}/slots/`), and a booking's seat is counted from `BOOKING` rows, so there is
  no second source of truth to keep in sync.
- **The fee lives on `LAB`**, and the refund split is snapshotted onto `PAYMENT`
  (`refund_amount`/`fee_amount`), so a later fee change never rewrites past refunds.
