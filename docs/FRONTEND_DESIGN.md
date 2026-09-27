# Frontend Design Doc

## 1. Purpose & Scope

The assignment is backend-only. The frontend is a bonus that shows the API working as a real
product. The first version (Phase 8) was a thin demo. It was then expanded into a full booking
site for patients and an analytics dashboard for businesses, with no changes to the API (see
§7).

Two audiences, two areas:

- **Patients** (`CLIENT`): find a test, compare centre prices in their city, book a slot, pay, and
  manage their bookings.
- **Businesses** (`LAB`, `CENTRE`, plus read-only `PLATFORM_ADMIN`): track bookings and revenue,
  manage prices and centres, and register walk-in patients.

## 2. Tech Stack

- **Next.js (App Router) + TypeScript.** Pages are server components only for the shell and
  `<title>` metadata. Everything that fetches data is a client component that calls the DRF API
  from the browser. There is no SSR data fetching.
- **Tailwind CSS v4 + shadcn/ui** (the Base UI–based "base-nova" style). Brand tokens (teal
  primary, chart colors) live in `app/globals.css`.
- **Recharts** for the two plotted charts (trend, hourly load). Ranked bars and the status
  breakdown are plain HTML so every value stays readable as text.
- **Plain `fetch`** in `lib/api/`: one wrapper with a shared 401→refresh→retry (concurrent 401s
  wait on a single refresh call). A small `useResource` hook handles loading, error, reload and
  local updates. React Context holds auth state and the dashboard's scope.
- **Session.** The refresh token is persisted in `localStorage` and the access token is kept in
  memory, so a reload keeps you signed in. The trade-off is XSS exposure of the refresh token; an
  httpOnly cookie would need backend changes.

## 3. UI Reference Sources

Layout conventions were taken from real diagnostics-booking platforms and adapted to our data
model:

- **Tata 1mg — Lab Tests**: test cards with "starting from" prices, search and filter bar,
  browse-by-concern categories.
- **Apollo 247 — Diagnostics**: date strip + time-slot grid, order summary beside each step.
- **PharmEasy — Checkout**: Card/UPI tab switcher.

## 4. Patient Screens

| Route | Screen |
|---|---|
| `/` | Hero search (test + city), catalog stats, browse by health concern, widely available tests, cities, how it works, business CTA |
| `/tests` | Search, category chips with counts, city/lab filters, sort by availability/price/name. Filters live in the URL, so views are shareable. "Starting from" prices reflect the selected city/lab |
| `/tests/[id]` | Compare every centre offering the test, filter by city, sort by price, "lowest price" marker, visit-prep tips |
| `/centres`, `/centres/[id]` | Centre directory grouped by city, with area search; centre page lists its tests by category |
| `/book?centreTestId=` | Step 1: 14-day date strip and 30-min slots (morning/afternoon/evening), sticky order summary |
| `/checkout/[id]` | Step 2: Card/UPI form → **EVE Pay sandbox** screen with *Approve* / *Decline* (stands in for the bank OTP page or UPI app). Then a confirmed / failed / cancelled outcome screen |
| `/account/bookings` | Summary tiles, Upcoming/Past/All tabs, status filter, search, pay and cancel actions |
| `/account/bookings/[id]` | Details, status timeline, payment summary, cancel, printable receipt |
| `/login`, `/signup` | Split-screen auth with a one-click demo login |

The payment simulation behaves as before: `POST /payments/orders/` opens or resumes an order, and
`POST /payments/` resolves it synchronously, so the page refreshes the booking immediately. The
webhook that arrives 2–8 s later is an idempotent no-op for state.

## 5. Business Screens (`/dashboard`, sign-in at `/business/login`)

Tabs by role. **Centre staff:** Dashboard · Bookings · Walk-in booking · Tests & pricing · Slots.
**Lab admin:** Dashboard · Bookings · Tests & pricing · Centres.

| Route | Roles | Screen |
|---|---|---|
| `/dashboard` | all business | Date range; KPIs with change vs the previous period (revenue incl. fees kept, bookings, paid rate, average order value); lifecycle strip (awaiting payment, completed, did not arrive, declined, cancelled); revenue/bookings trend; outcome breakdown across all 7 statuses; top tests; top centres (lab) or busiest hours; **why payments fail** and **why bookings are cancelled**; next 7 days; latest bookings |
| `/dashboard/bookings` | all business | Status chips, search by patient name/email/booking id/test, centre/date filters, sort, pagination, CSV export (incl. reason and refund split), cancel (lab only). Rows show the patient's name, "Arrival overdue", and the cancellation/decline reason |
| `/dashboard/bookings/[id]` | all business | Detail with patient card, status history from the event log (who, when, why), refund breakdown, decline diagnosis; **Mark test completed** / **Mark report delivered**; centre staff collect payment inline for PENDING walk-ins |
| `/dashboard/walk-in` | CENTRE | 1) Patient: look up by email, or register (name, phone, DOB, gender) 2) test 3) real slot with seats left; then payment |
| `/dashboard/catalog` | LAB, CENTRE | Lab: editable prices, market average across all centres ("Only your lab offers this" when it's the only one), upcoming bookings "here · all centres", add tests. Centre: read-only prices, availability toggle, upcoming bookings per test |
| `/dashboard/slots` | CENTRE | Weekly schedule editor (ranges × seats per 30-min slot), 28-day calendar (custom hours / fully booked / closed), per-day panel: customise from the weekly hours, close the day, reset, seats booked per slot |
| `/dashboard/centres` | LAB | Transaction-fee setting; centre cards with 30-day revenue, bookings, paid rate, next-7-day load; add/edit centres |
| `/dashboard/centres/[id]` | LAB | One centre's KPIs, its bookings (the bookings table scoped to the centre) and its slots, read-only |

Navigation and actions follow the backend permission matrix (`lib/roles.ts`); the API enforces
every rule regardless. Patients see decline reasons with a "what to do" hint on the checkout
failure screen, pick a cancellation reason with a refund preview, and book from real slots showing
seats left.

### Chart rules

- Revenue and booking counts are toggled rather than drawn against two y-axes.
- Booking statuses use a reserved status palette and are always shown with an icon, a label and a
  count, so color never carries the meaning alone.
- Single-series charts use the brand teal `#0d9488`, which passes contrast on the card surface.
  Bars are capped at 24 px, lines are 2 px, gridlines are hairlines, and there is a hover tooltip
  on every plotted mark.
- Revenue means bookings that went ahead (awaiting arrival, completed, report delivered) plus the
  fee kept on patient cancellations and no-shows, dated by booking creation.

## 6. Explicit Non-Goals

- No real card or UPI validation, and nothing PCI-related: everything is clearly a simulation.
- No dark mode (the tokens exist but no toggle is shipped).
- No frontend test suite. The flows were verified end-to-end in a headless browser.

## 7. Working Within the Existing API

No endpoints were added for the frontend. The gaps were bridged client-side, and each one is a
candidate backend improvement:

| Gap | Workaround | Better backend answer |
|---|---|---|
| No cross-centre test search | Load the catalog once per session into an in-memory index | A search/offerings endpoint with filters |
| No analytics endpoint | Aggregate the role-scoped `GET /bookings/` in `lib/analytics.ts` | A server-side aggregates endpoint, plus pagination |
| No test categories | Derive categories from test names | A `category` field on `Test` |

The demo dashboard needs history, so `seed_demo_bookings` backfills 90 days of bookings with
matching payments.
