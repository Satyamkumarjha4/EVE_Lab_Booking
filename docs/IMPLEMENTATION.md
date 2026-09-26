# Running the Project

Everything runs through Docker Compose — no local Python/Postgres/Redis install is required.

## Prerequisites

- Docker Engine + the Docker Compose plugin (`docker compose version`).

## First-time setup

```bash
cp backend/.env.example backend/.env
```

`backend/.env` is git-ignored (it's read by both the `web` and `celery-worker` containers via
`env_file`). The committed `.env.example` has working defaults for local Docker use — edit
`backend/.env` if you need different values (e.g. a real `SECRET_KEY` outside local dev).

## Starting the stack

```bash
docker compose up -d --build
```

This brings up four containers:

| Service | What it is | Host port | Notes |
|---|---|---|---|
| `db` | PostgreSQL 16 | `5433` → 5432 in-container | remapped from 5432 to avoid clashing with a local Postgres |
| `redis` | Redis 7 | `6380` → 6379 in-container | remapped from 6379 to avoid clashing with a local Redis; broker (DB 1) + cache (DB 0) share this instance |
| `web` | Django (runserver) | `8000` | runs `migrate` then `runserver 0.0.0.0:8000` on every start |
| `celery-worker` | Celery worker, same image as `web` | — | not exposed on the host; `celery -A eve worker -l info` |

If your machine has no local Postgres/Redis running, you can change the port mappings in
`docker-compose.yml` back to `5432:5432` / `6379:6379` — nothing else depends on the remap.

`web` and `celery-worker` bind-mount `./backend` into `/app` (with the SELinux `:Z` label, needed
on Fedora/RHEL-family hosts running SELinux in enforcing mode — harmless if SELinux isn't in use),
so code edits are picked up without rebuilding the image. Only changes to `requirements.txt` or the
`Dockerfile` require `docker compose up -d --build` again.

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
    Lab/Centre/Platform Admin accounts are provisioned via Django admin (or a future seed command),
    not through this endpoint.
  - `POST /auth/login/` — `{"email": ..., "password": ...}` → `{"access": ..., "refresh": ...}`
    (access token ~15 min, refresh ~7 days).
  - `POST /auth/refresh/` — `{"refresh": ...}` → `{"access": ...}`.
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
- **Celery**: there's no dashboard yet (Flower isn't wired up) — check worker activity via its logs
  (below). `celery-worker` logs "ready" on boot and logs each task as it's received/executed once
  tasks exist (Phase 5 wires the first real task, `deliver_payment_webhook`).

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
be up first. Currently covers the health/root endpoints and the full auth flow (signup, login,
refresh — happy paths and edge cases); more tests land alongside each phase's endpoints per
`docs/PHASES.md`.

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

## Current status / what's not built yet

Phase 1 is complete: project bootstrap, Docker Compose (db/redis/web/celery-worker), health check,
Swagger, the custom `User` model (`role`, nullable `lab`/`centre` FKs, email-based login), and JWT
auth (`/auth/signup/`, `/auth/login/`, `/auth/refresh/`). A minimal `catalog` app (`Lab`, `Centre`)
was added ahead of schedule, just enough for the `User` FKs — its full read API and `Test`/
`CentreTest` models land in Phase 2 along with everything else from Phase 2 onward (bookings,
payments, webhooks, caching, rate limiting) — see `docs/PHASES.md` for the build order.

Deferred by design (not oversights) — see `docs/ARCHITECTURE.md` §10 for the reasoning: structured
logging (stdlib logging only), pagination, and webhook retry/backoff.
