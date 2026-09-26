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
    PAYMENT ||--o{ PAYMENT_EVENT : "receives"

    LAB {
        uuid id PK
        string name
        string location
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
        timestamp created_at
    }

    BOOKING {
        uuid id PK
        uuid client_id FK "USER, role=CLIENT"
        uuid centre_test_id FK
        datetime appointment_at
        decimal amount
        enum status "PENDING | CONFIRMED | FAILED | CANCELLED"
        timestamp created_at
        timestamp updated_at
    }

    PAYMENT {
        uuid id PK
        uuid booking_id FK
        uuid reference UK "client-facing order id"
        decimal amount
        enum method "CARD | UPI"
        enum status "INITIATED | SUCCESS | FAILED"
        enum refund_status "NONE | SIMULATED_REFUNDED"
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
