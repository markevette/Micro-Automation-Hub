# Installation and Run Instructions – Micro Automation Hub

These instructions describe how to install, configure, and run the Micro Automation Hub using Docker and docker-compose. The steps ensure reproducibility across environments and support evaluation of the application.

## 1. Prerequisites

- Docker (with the Compose v2 plugin, included in Docker Desktop)
- Git
- Internet connection (required for pulling base images)

For local development outside Docker you will also need Node.js 20+ and Python 3.11+.

## 2. Clone the Repository

```bash
git clone https://github.com/markevette/Micro-Automation-Hub.git
cd Micro-Automation-Hub/infrastructure
```

## 3. Environment Configuration

Copy the example environment file:

```bash
cp env.example .env
```

docker-compose reads `.env` from the `infrastructure/` directory automatically.
Adjust values as needed (database credentials, host ports, email provider settings).
At minimum, change `POSTGRES_PASSWORD` before any non-local deployment.

## 4. Build and Start the Application

Run the following command from the `infrastructure` directory:

```bash
docker compose up --build
```

This starts:

- Frontend (React, served by nginx) on http://localhost:3000
- Backend (FastAPI) on http://localhost:8000
- PostgreSQL database on `localhost:5433`

The host Postgres port defaults to **5433** so it does not collide with a
Postgres instance already running locally on 5432. Inside the compose network the
database is always reached as `db:5432`.

The backend waits for the database to pass its healthcheck before starting.

## 5. Verify the Application

Open the frontend at http://localhost:3000.

Check the backend directly:

```bash
curl http://localhost:8000/health      # {"status":"ok"} – process is up
curl http://localhost:8000/health/db   # {"status":"ok"} – database reachable
```

Interactive API documentation is available at http://localhost:8000/docs.

## 5a. Running the Example Automation

The **GitHub repo watcher** workflow is seeded automatically on first startup.
Open http://localhost:3000 and press **Run** on it; the result panel shows each
block's status, duration, logs, and output in order.

Equivalently, from the command line:

```bash
curl http://localhost:8000/api/workflows          # list workflows
curl -X POST http://localhost:8000/api/workflows/1/run
curl http://localhost:8000/api/runs               # run history
```

Note that this example calls the public GitHub API, so it needs outbound network
access and is subject to GitHub's unauthenticated rate limit.

To execute a definition without saving it first, post it to `/api/runs/ad-hoc`.
`GET /api/blocks` returns the available block types together with the JSON schema
of each block's configuration.

## 5b. Building Your Own Workflow

Press **New workflow** in the header, then add blocks from the palette on the
right. Blocks run top to bottom and each receives the previous block's output, so
order matters — use the ↑ and ↓ controls to rearrange them.

A typical chain starts with **HTTP Request** to fetch data, narrows it with
**Extract Fields** (the incoming response is usually far larger than you need),
gates it with **Filter**, and ends with **Text Transform** and **Notification**.

Two things worth knowing while composing:

- **Test run** executes the draft immediately without saving it. The run is
  recorded in the history but is not attached to a workflow, so you can iterate
  before committing to anything.
- In templates, reference incoming fields by name in braces, e.g.
  `{stars}`. `{input}` refers to the entire incoming value, which is what you
  want after a Text Transform block has already reduced the data to a string.

Press **Create workflow** to save it, or **Edit** on an existing workflow to
change it in place.

A run finishes in one of three states: `success`, `failed` (a block errored), or
`filtered` (a filter condition was not met, so the remaining blocks were skipped).
Blocks after the stopping point are not recorded, which is why a filtered run
shows fewer steps than the workflow has blocks.

## 6. Stopping the Application

```bash
docker compose down
```

Database contents survive this because they live in the `postgres_data` volume.
To discard the data as well:

```bash
docker compose down -v
```

## 7. Local Development Without Docker

Frontend:

```bash
cd frontend
npm install
npm start
```

Backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --reload
```

Note that running the frontend with `npm start` serves it on port 3000 too, so
stop the `frontend` container first if the stack is up.

## 7a. Running the Tests

Backend, from the `backend` directory (needs `requirements-dev.txt` installed):

```bash
pytest
```

Frontend, from the `frontend` directory:

```bash
npm test -- --watchAll=false
```

Neither suite needs a database or network access: the API tests substitute
in-memory SQLite through a dependency override, and the engine tests substitute
the HTTP transport. Expect 27 backend and 15 frontend tests.

## 8. Cloud Deployment

For cloud deployment, use the same docker-compose configuration on your hosting
provider (e.g. Render, Railway, or a VM). Ensure environment variables are
configured identically, and note that `REACT_APP_API_URL` is baked into the
frontend at **build** time — it must be set before building the image, not just
at runtime. See [deployment notes](../infrastructure/deployment-notes.md).

## 9. Troubleshooting

**Containers fail to start.** Ensure no other services are using ports 3000,
8000, or 5433. Override `FRONTEND_PORT`, `BACKEND_PORT`, or `POSTGRES_PORT` in
`.env` if they are taken.

**Backend cannot connect to the database.** Check `/health/db`. Verify the
credentials in `.env` match, and confirm the `db` service is healthy with
`docker compose ps`.

**Frontend cannot reach the backend.** Confirm `BACKEND_CORS_ORIGINS` in `.env`
includes the origin you are loading the frontend from, and that
`REACT_APP_API_URL` pointed at the right backend URL when the image was built.
Changing `REACT_APP_API_URL` requires `docker compose up --build`. The symptom is
an empty workflow list with a CORS error in the browser console and nothing
unusual in the backend logs, because the request never arrived.

**A workflow run fails on the HTTP request block.** The seeded example calls the
public GitHub API. Check outbound network access from the container, and note
that GitHub's unauthenticated rate limit is low enough to hit while testing.

**A schema change is not reflected in the database.** Tables are created at
startup and never altered, so adding or changing a column requires
`docker compose down -v` to discard the volume. There is no migration tool yet.

## 10. Further Documentation

- [API reference](api-reference.md) — endpoints, block configurations, error semantics
- [Architecture](architecture/README.md) — structure, execution engine, data model, deployment view
- [Requirements](requirements/functional.md) — with implementation status
- [Deployment notes](../infrastructure/deployment-notes.md) — operating the stack
