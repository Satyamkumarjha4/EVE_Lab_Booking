# Frontend

Next.js (App Router) + TypeScript + Tailwind + shadcn/ui bonus app (see
[docs/PHASES.md](../docs/PHASES.md) Phase 8 and
[docs/FRONTEND_DESIGN.md](../docs/FRONTEND_DESIGN.md)). Built early/out of order relative to
backend Phases 5-7 to allow a UI preview; talks to the Django backend directly from the browser
(no SSR/data-fetching used — plain client-side `fetch`, JWT held in memory only).

## Run locally

1. Make sure the backend is running from the repo root:
   ```bash
   docker compose up -d --build
   docker compose exec web python manage.py seed_demo_data
   ```
2. `cp .env.local.example .env.local` (sets `NEXT_PUBLIC_API_BASE_URL`).
3. `npm install`
4. `npm run dev` — serves on `http://localhost:3000`.

## Notes

- `seed_demo_data` creates three logins, all with password `EveDemo@2026`:
  `client@demo.eve` (books and pays), `lab@demo.eve` (Apollo Diagnostics; the Lab dashboard view
  on `/bookings` with cancel rights) and `centre@demo.eve` (Apollo – Connaught Place; walk-in
  bookings, no cancel). New CLIENT accounts can also be created via `/signup`.
- Catalog management (Lab/Centre price and availability edits) is API-only for now; there is no
  screen for it. Use Swagger or the curl examples in the root README.
- The session is held in memory only (no localStorage/cookies) — a hard page reload logs you out.
  This is a deliberate simplicity tradeoff, not a bug (see `docs/FRONTEND_DESIGN.md` §2).
- No frontend test suite — out of scope for this demo (see `docs/FRONTEND_DESIGN.md` §6).
