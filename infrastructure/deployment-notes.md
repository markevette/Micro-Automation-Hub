# Deployment Notes – Micro Automation Hub

Notes on how the containerised stack is put together and what to watch for when
deploying it. For step-by-step setup, see
[installation & run instructions](../docs/installation-run-instructions.md).

## Stack Composition

| Service    | Image                | Host port | Container port |
|------------|----------------------|-----------|----------------|
| `frontend` | built from `frontend/` | 3000    | 80             |
| `backend`  | built from `backend/`  | 8000    | 8000           |
| `db`       | `postgres:15-alpine`   | 5433    | 5432           |

All host ports are overridable via `.env` (`FRONTEND_PORT`, `BACKEND_PORT`,
`POSTGRES_PORT`).

## Configuration

Configuration flows in one direction: `.env` → compose interpolation → container
environment. `env.example` is a tracked template and is **never** read by
compose directly, so editing it has no effect on a running stack — copy it to
`.env` instead.

Compose defaults exist for every variable so the stack boots without a `.env`.
This is a convenience for local evaluation only; `POSTGRES_PASSWORD` must be
overridden anywhere else.

`DATABASE_URL` is assembled in `docker-compose.yml` from the Postgres variables
rather than being set by hand, which keeps the credentials in one place. It
points at `db:5432` — the internal service port, independent of `POSTGRES_PORT`.

## Startup Ordering

`depends_on` alone only waits for a container to *start*, not to become usable,
which makes the backend race Postgres. The `db` service therefore declares a
`pg_isready` healthcheck and the backend uses `condition: service_healthy`.

The backend has its own healthcheck against `/health`, so `docker compose ps`
reports whether the API is actually serving.

## Data Persistence

Postgres data lives in the named volume `postgres_data`, so `docker compose down`
and container recreation preserve it. `docker compose down -v` destroys it.

There is no backup or migration tooling yet — schema management is listed in the
[technical debt register](../docs/technical-debt.md).

## Image Build Notes

Both images build from the lockfile/pinned requirements rather than resolving
versions at build time, so repeated builds produce the same dependency set.

The frontend is a two-stage build: Node compiles the static bundle, then only the
compiled output is copied into an nginx image. The runtime image contains no
Node.js and no `node_modules`. nginx is configured to fall back to `index.html`
so client-side routing survives a hard refresh.

**`REACT_APP_API_URL` is a build-time argument.** Create React App inlines
environment variables into the bundle during `npm run build`, so this value
cannot be changed by restarting the container — it requires a rebuild
(`docker compose up --build`). This is the most common deployment mistake with
this stack.

`.dockerignore` files keep the host `node_modules`, virtualenvs, and caches out
of the build context. Without them the frontend context alone is several hundred
megabytes and the host's platform-specific `node_modules` can overwrite the
one installed inside the image.

The backend image runs as a non-root `appuser`.

## Known Gaps

Roughly in order of severity:

- **The API is unauthenticated, and the HTTP request block will call any URL it
  is given** from inside the container network. A public deployment could be used
  to reach internal services or as an anonymising request proxy. Authentication
  and an outbound allow-list are prerequisites for exposing this stack.
- No HTTPS/TLS termination; add a reverse proxy or platform-managed certificate
  in front of the stack for any public deployment.
- Secrets are supplied as plain environment variables, which is adequate for
  local evaluation but should move to a managed secret store in the cloud.
- No database migration tool. Tables are created by `create_all()` at startup,
  which cannot alter an existing schema, so a model change currently requires
  discarding the volume. Adopting Alembic should also remove the startup call.
- No backups of the `postgres_data` volume.
- No CI pipeline builds or tests the images.

## See Also

The [architecture deployment view](../docs/architecture/deployment.md) covers the
same stack with topology, configuration-flow, and startup-ordering diagrams, plus
the reasoning behind the build-time versus runtime configuration split.
