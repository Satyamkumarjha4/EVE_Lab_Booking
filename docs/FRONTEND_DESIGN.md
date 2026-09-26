# Frontend Design Doc

## 1. Purpose & Scope

The assignment is backend-only; the frontend exists purely as a **brownie-points demo** to show API
integration ability and UX sense — built *after* the backend is complete and tested (see Phases
doc). It should stay minimal: enough screens to show the full booking → payment simulation → status
flow end-to-end, plus a thin Lab view. No production polish, no full design system beyond what's
needed for a clean demo.

## 2. Tech Stack

- **Next.js (App Router) + TypeScript** — chosen over the originally-planned Vite+React so the demo
  could be previewed/built out of order relative to the backend phases (see `docs/PHASES.md` Phase
  8). No SSR/data-fetching features are actually used — every page is a client component
  (`"use client"`) hitting the DRF API directly from the browser; Next.js is used purely as the
  project scaffold/router, this remains a client-rendered SPA-style app.
- **Tailwind CSS** for styling.
- **shadcn/ui** for components (buttons, cards, dialogs, tabs, form inputs) — gives a clean,
  professional look with minimal custom CSS work.
- Plain `fetch` for API calls (one wrapper function with a 401→refresh→retry-once pattern); JWT
  stored in memory + refreshed via the refresh endpoint (no need for a heavy state library at this
  scope — React Context for auth state is enough). A hard page reload loses the session — a
  deliberate tradeoff, not a bug.

## 3. UI Reference Sources

Look/pattern inspiration pulled from real diagnostics-booking platforms, adapted (not copied) to
our data model:

- **Tata 1mg — Lab Tests section**: centre/test card layout (test name, price, "book now"), search
  + filter bar pattern.
- **Apollo 247 — Diagnostics booking flow**: appointment date/time picker step, order summary
  before payment.
- **PharmEasy — Checkout / payment method tabs**: Card vs. UPI tab switcher pattern, used directly
  for our simulated payment screen.

We are not scraping their UI/data; these are used only as reference for layout conventions and
seed-data realism (test names, typical price ranges).

## 4. Screens (Client-facing)

1. **Auth** — Login / Signup (single form, role fixed to CLIENT for self-signup; Lab/Centre accounts
   are seeded, not self-service).
2. **Catalog / Home** — list of centres, each expandable to its test list with prices (maps to
   `GET /centres/`, `GET /centres/{id}/tests/`).
3. **Booking creation** — pick a test @ centre (carried over from catalog), pick appointment
   date/time, review amount, confirm → creates `PENDING` booking.
4. **Payment simulation** — the centerpiece screen:
   - Tabs: **Card** (dummy fields: number/expiry/cvv, no real validation) / **UPI** (QR placeholder
     + UPI ID text).
   - On submit, reveal **Simulate Success** / **Simulate Failure** buttons (standing in for the
     customer's bank/UPI app step — see PRD §5).
   - On click, call `POST /payments/` (payment simulate endpoint). It is synchronous and final: the
     response already carries the resolved payment and booking status, so the UI shows it
     immediately with no polling. The provider webhook the backend enqueues arrives 2–8 s later
     and confirms the same outcome, which is an idempotent no-op for state, so nothing on screen
     changes.
   - Re-opening checkout for a booking whose order was abandoned resumes that same order (the
     backend returns it with 200) instead of erroring.
5. **Booking history / status** — list of the client's own bookings with status badges
   (PENDING/CONFIRMED/FAILED/CANCELLED) and a **Cancel** action where allowed.

## 5. Screens (Lab-facing, thin)

1. **Login** (same auth screen, role resolves to LAB).
2. **Bookings dashboard** — table of all bookings across the lab's centres, with a **Cancel**
   action. No catalog-management UI in v1 (that stays in Django admin) unless time permits.

Centre role gets **no dedicated UI** in v1 — it's read-only in the API and not worth a screen for a
brownie-points frontend; can be added later if time allows.

## 6. Explicit Non-Goals

- No real card/UPI validation or PCI-anything — everything is clearly a simulation.
- No responsive/mobile-first polish beyond what Tailwind gives by default.
- No design system doc beyond this file — shadcn/ui defaults are the design system.
- No client-side test suite required (backend tests are what's graded); may add a couple of smoke
  tests if time allows.
