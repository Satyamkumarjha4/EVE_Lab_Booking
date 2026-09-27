# Frontend

Next.js (App Router) + TypeScript + Tailwind v4 + shadcn/ui (Base UI flavour) + Recharts. It talks
to the Django API directly from the browser. Every data-fetching component is a client component;
server components are only used for page shells and `<title>` metadata. See
[docs/FRONTEND_DESIGN.md](../docs/FRONTEND_DESIGN.md) for the design and scope.

## Run locally

1. Start and seed the backend from the repo root:
   ```bash
   docker compose up -d --build
   docker compose exec web python manage.py seed_demo_data
   docker compose exec web python manage.py seed_demo_bookings   # 90 days of history for the dashboard
   ```
2. `cp .env.local.example .env.local` (sets `NEXT_PUBLIC_API_BASE_URL`).
3. `npm install`
4. `npm run dev`, then open http://localhost:3000.

`npm run lint` and `npm run build` should both pass cleanly.

## Demo logins (password `EveDemo@2026`)

| Where | Account | What to try |
|---|---|---|
| `/login` | `client@demo.eve` | Browse and filter tests by city, compare centre prices, book a slot, pay by card/UPI, manage bookings |
| `/business/login` | `lab@demo.eve` | Apollo Diagnostics analytics across 3 centres (incl. decline and cancellation reasons), bookings with cancel and CSV export, pricing vs. market, transaction fee, each centre's bookings and read-only slots |
| `/business/login` | `centre@demo.eve` | Single-centre analytics, walk-ins (find or register the patient, book a real slot, take payment), mark tests completed / reports delivered, slot schedule, test availability (prices are read-only) |

Both login pages have one-click demo buttons. `seed_demo_bookings` also creates
`patient1…8@demo.eve`, which own the historical bookings.

## Structure

```
app/(site)/        patient site: home, /tests, /tests/[id], /centres, /centres/[id],
                   /book, /checkout/[id], /account/bookings[/id]
app/(auth)/        /login, /signup, /business/login (split-screen, no site chrome)
app/dashboard/     business area: overview, bookings[/id], walk-in, catalog (pricing), centres
components/        grouped by feature (catalog, booking, payment, dashboard, site, auth, common)
lib/api/           fetch client (JWT + shared 401→refresh→retry) and one function per endpoint
lib/catalog.ts     in-memory catalog index (see below)
lib/analytics.ts   KPIs, trends and rankings derived from GET /bookings/
```

## Notes and trade-offs

- **Search and comparison run client-side.** The API has no cross-centre search, so the catalog
  (`GET /centres/` + each centre's `/tests/`) is loaded once per session into an index that powers
  the search, city/lab/category filters and price comparison. That's 19 cached requests with the
  seed data. At real scale this would move to a search endpoint.
- **Analytics run client-side** over the role-scoped, unpaginated `GET /bookings/`. It's fine for
  the demo (about 400 bookings for the demo lab). A production version would use a server-side
  aggregate endpoint.
- **Test categories** ("Heart", "Diabetes", …) are derived from test names
  (`lib/test-categories.ts`) because the API has no category field.
- **Session.** The refresh token is kept in `localStorage`, so a reload keeps you signed in; the
  access token stays in memory. An httpOnly refresh cookie would be safer against XSS but needs
  backend support.
- **Times are centre-local.** Slots and appointments always display in `Asia/Kolkata`, whatever
  the viewer's time zone, since that's when the patient has to be at the centre.
- Payments are simulated. The card/UPI fields are not validated or sent anywhere.
- There is no frontend test suite; the flows were verified end-to-end in a headless browser.
