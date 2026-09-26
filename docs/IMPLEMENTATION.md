# Running the Project

Everything runs through Docker Compose — no local Python/Postgres/Redis install is required.

## Prerequisites

- Docker Engine + the Docker Compose plugin (`docker compose version`).

## First-time setup

```bash
cp backend/.env.example backend/.env
```

`backend/.env` is git-ignored (it's read by both the `web` and `celery-worker` containers via
`env_file`). The committed `.env.example` has working defaults for local Docker use: its
`POSTGRES_*` values match the `db` service's defaults in `docker-compose.yml`. Edit `backend/.env` if
you need different values. `SECRET_KEY` and `WEBHOOK_SECRET` have **no fallback in settings**, so the
app refuses to start without them rather than silently running on a publicly known key. Use long
random values anywhere other than local dev.

> **Upgrading an older `backend/.env`?** If yours predates Phase 5, add `WEBHOOK_SECRET` and
> `INTERNAL_BASE_URL=http://web:8000`, add `web` to `ALLOWED_HOSTS` (the worker calls the webhook
> at `http://web:8000`), then `docker compose up -d --force-recreate web celery-worker`. A plain
> `restart` does not reload `env_file`.

## Starting the stack

```bash
docker compose up -d --build
```

This brings up four containers:

| Service | What it is | Host port | Notes |
|---|---|---|---|
| `db` | PostgreSQL 16 | `127.0.0.1:5433` → 5432 in-container | remapped from 5432 to avoid clashing with a local Postgres; localhost-only |
| `redis` | Redis 7 | `127.0.0.1:6380` → 6379 in-container | remapped from 6379 to avoid clashing with a local Redis; broker (DB 1) + cache (DB 0) share this instance; localhost-only |
| `web` | Django (runserver) | `8000` | runs `migrate` then `runserver 0.0.0.0:8000` on every start |
| `celery-worker` | Celery worker, same image as `web` | — | not exposed on the host; `celery -A eve worker -l info` |

If your machine has no local Postgres/Redis running, you can change the port mappings in
`docker-compose.yml` back to `127.0.0.1:5432:5432` / `127.0.0.1:6379:6379`; nothing else depends
on the remap. Keep the `127.0.0.1:` prefix. Docker's port publishing bypasses host firewalls, and
Redis has no password and doubles as the Celery broker, so anyone who can reach it could enqueue
webhook tasks that the worker signs with the real secret.

`web` and `celery-worker` bind-mount `./backend` into `/app`, so code edits are picked up without
rebuilding the image. Only changes to `requirements.txt` or the `Dockerfile` need
`docker compose up -d --build` again. The mount uses the SELinux **`:z`** (lowercase) label, which is
required on Fedora/RHEL-family hosts with SELinux enforcing and harmless elsewhere. It must be
lowercase: uppercase `:Z` makes the label private to one container, so whichever of the two
containers starts second relabels the directory and the other gets `Permission denied` or
`ModuleNotFoundError` reading its own code.

## Checking it's up

```bash
docker compose ps
```

All four should show `Up`/`healthy`. First boot takes a few seconds while `db`/`redis` pass their
healthchecks before `web`/`celery-worker` are allowed to start.

## Accessing things

- **API root / health check**: `GET http://localhost:8000/api/health/` — returns
  `{"status": "ok", "checks": {"database": true, "redis": true}}` (HTTP 503 if either dependency is
  unreachable). Unauthenticated, always-on — use this to sanity-check the whole stack in one call.
- **Swagger UI**: http://localhost:8000/api/schema/swagger-ui/
- **Raw OpenAPI schema**: http://localhost:8000/api/schema/
- **Django admin**: http://localhost:8000/admin/ — create a superuser first:
  ```bash
  docker compose exec web python manage.py createsuperuser
  ```
  Note: the custom `User` model is email-based (`AUTH_USER_MODEL = "accounts.User"`, `USERNAME_FIELD
  = "email"`), so this now prompts for an email address, not a username.
- **Auth (JWT)**:
  - `POST /auth/signup/` — `{"email": ..., "password": ...}` → creates a `CLIENT`-role user (201).
    Lab/Centre/Platform Admin accounts are provisioned via Django admin, not through this
    endpoint. `seed_demo_data` also creates `client@demo.eve`, `lab@demo.eve` and
    `centre@demo.eve` (password `EveDemo@2026`).
  - `POST /auth/login/` — `{"email": ..., "password": ...}` → `{"access": ..., "refresh": ...}`
    (access token ~15 min, refresh ~7 days).
  - `POST /auth/refresh/` — `{"refresh": ...}` → `{"access": ...}`.
  - `GET /auth/me/` — auth required → `{"id", "email", "role", "lab", "centre"}` for the logged-in
    user. Added alongside the frontend since the JWT itself carries no custom claims.
- **Catalog**: `GET /centres/`, `GET /centres/{id}/tests/`, `GET /tests/` are public reads
  (role-scoped for `CENTRE` logins). Lab/Centre managers also get `POST /centres/`,
  `PATCH /centres/{id}/`, `POST /centres/{id}/tests/` and `PATCH /centres/{id}/tests/{ct_id}/`.
  Run `seed_demo_data` for realistic data.
- **Bookings**: `POST/GET /bookings/`, `GET /bookings/{id}/`, `POST /bookings/{id}/cancel/` —
  role-scoped per `docs/ARCHITECTURE.md`'s permission matrix.
- **Payments**: `POST /payments/orders/` (open or resume an order against a `PENDING` booking),
  `POST /payments/` (simulate `SUCCESS`/`FAILED`; also enqueues the webhook),
  `POST /payments/webhook/` (HMAC-signed provider callback, idempotent on `event_id`). The README
  has a copy-paste `openssl` snippet for signing a webhook by hand.
- **Postgres** (from the host, e.g. with `psql` or a GUI client):
  ```bash
  psql -h localhost -p 5433 -U eve -d eve   # password: eve (see backend/.env)
  ```
  Or from inside the network:
  ```bash
  docker compose exec db psql -U eve -d eve
  ```
- **Redis**:
  ```bash
  docker compose exec redis redis-cli
  # or from the host:
  redis-cli -p 6380
  ```
- **Celery**: there's no dashboard (Flower isn't wired up), so check worker activity via its logs
  (below). Each `POST /payments/` produces a `deliver_payment_webhook … received`, then about 2–8 s
  later a `… succeeded` line. A failed delivery (connection error or non-2xx reply) is logged as
  `Webhook delivery failed for payment <reference>` with the reason.

## Logs

```bash
docker compose logs -f web              # Django server log (requests, migrations, tracebacks)
docker compose logs -f celery-worker    # Celery worker log
docker compose logs -f db               # Postgres log
docker compose logs -f redis            # Redis log
docker compose logs -f                  # everything, interleaved
```

Drop `-f` for a one-off dump instead of following.

## Running tests

```bash
docker compose exec web pytest -v
```

Tests use `pytest-django` against the same Postgres/Redis the app containers use, so the stack must
be up first (pytest-django creates a separate `test_eve` database). `conftest.py` clears Redis
before each test and mocks the Celery enqueue, so the suite never pushes tasks to the live worker.
`core/tests/test_schema.py` fails if the OpenAPI schema generates any warning. The README's §9
breaks down what's covered.

## Running Django management commands

Any `manage.py` command runs the same way, e.g.:

```bash
docker compose exec web python manage.py migrate
docker compose exec web python manage.py makemigrations
docker compose exec web python manage.py shell
```

## Stopping

```bash
docker compose down          # stop + remove containers, keep the Postgres volume (data persists)
docker compose down -v       # also delete the Postgres volume (fresh DB next `up`)
```

> **One-time gotcha if you pulled this repo before the custom `User` model landed**: your local
> Postgres volume may have migrations applied against Django's *default* `auth.User` table. Swapping
> `AUTH_USER_MODEL` after that isn't supported without a clean slate — run `docker compose down -v`
> once, then `docker compose up -d --build` to rebuild from scratch. Not needed for a fresh clone.

## Running the frontend

A Next.js (App Router) frontend lives in `frontend/`, built early/out of order (before backend
Phases 5-7) so the UI could be previewed sooner — see `docs/PHASES.md` Phase 8 and
`frontend/README.md` for full details. Quick start:

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev   # http://localhost:3000
```

Requires the backend running (`docker compose up -d --build`) with `seed_demo_data` run at least
once. The backend has `django-cors-headers` configured to allow `http://localhost:3000` by default.
The frontend is not (yet) part of `docker-compose.yml`; it's a separate local dev server.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `web` exits with `ImproperlyConfigured: Set the SECRET_KEY` (or `WEBHOOK_SECRET`) | `backend/.env` is missing that key. Copy it from `.env.example` |
| `web` can't connect to Postgres on a fresh clone | `backend/.env` `POSTGRES_*` doesn't match the `db` service (both default to `eve`/`eve`/`eve`) |
| `PermissionError` / `ModuleNotFoundError` for project files inside a container | SELinux mount label: the volumes must use `:z`, not `:Z` (see above) |
| Payments succeed but no `PaymentEvent` rows appear | Check `docker compose logs celery-worker` for `Webhook delivery failed`. A `DisallowedHost` 400 means `web` is missing from `ALLOWED_HOSTS` |
| `429 Too Many Requests` while demoing | Login/signup allow 5/min per IP. Wait a minute, or run `docker compose exec redis redis-cli -n 0 FLUSHDB` |

## Current status

Phases 0–8 are complete: bootstrap and Docker, JWT auth, the catalog (reads plus Lab/Centre
management) with demo data and logins, role-scoped bookings, payment orders and simulation, the
Celery-delivered HMAC webhook with `PaymentEvent` idempotency, Redis catalog caching, rate
limiting, the final audit and docs, and the bonus Next.js frontend. The root `README.md` is the
entry point.

Deferred by design (not oversights; see `docs/ARCHITECTURE.md` §10 and README §12): structured
logging (stdlib logging only), pagination, and webhook retry/backoff.
