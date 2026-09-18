# Micro-Automation-Hub
DLMCSPSE01 (SE Project)

A modular, cloud-hosted web application enabling users to build and execute lightweight browser-based automations using configurable workflow blocks. Designed as part of the IU Software Engineering Portfolio (DLMCSPSE01), the project demonstrates full lifecycle development including requirements analysis, architecture design, implementation, testing, deployment, and reflection.

## Project Status

A working end-to-end slice exists: workflows can be defined, executed block by
block, and inspected afterwards.

Implemented today:

- **Block library** — five block types: HTTP request, field extraction, filter,
  text transform, and notification
- **Sequential execution engine** — runs blocks in order, passing each block's
  output to the next, and stops at the first block that fails or filters the run out
- **Run history** — every run is persisted with per-block status, duration, logs,
  and output; oversized outputs are summarised rather than stored in full
- **REST API** — workflow CRUD, saved and ad-hoc execution, run history, and a
  block catalogue that publishes each block's config schema
- **Frontend** — lists workflows, runs them, and shows a per-block timeline with
  logs, timings, and outputs
- **Workflow builder** — add blocks from a palette, configure each one through
  type-specific controls, reorder and remove them, test-run the draft without
  saving, then save it as a new workflow or update an existing one
- One seeded example workflow (see below) that exercises every block type
- `/health` (liveness) and `/health/db` (database readiness) endpoints
- PostgreSQL with a persistent volume and startup healthcheck, plus reproducible
  Docker builds orchestrated by docker-compose

Not yet implemented: drag-and-drop block reordering (blocks move with up/down
controls instead), scheduled or triggered runs, user accounts and access control,
email notifications, and database migrations.

## Example Automation

The **GitHub repo watcher** workflow is seeded on first startup and chains all
five block types:

```
http_request  ->  json_extract  ->  filter  ->  text_transform  ->  notification
fetch a repo      keep 4 fields     stars     build a summary     emit the alert
                                    > 1000
```

If the filter condition fails the run stops there and is recorded as `filtered`
rather than `failed`, so a workflow that legitimately had nothing to do is
distinguishable from one that broke.

## Roadmap

The next increments, in the order they would add the most value:

1. Authentication and per-user workflows, plus an outbound allow-list for the
   HTTP request block — required before any public deployment
2. Scheduled and event-triggered runs
3. Branching, by replacing the single-value chain with a named context
4. Email notifications behind the existing `channel` field
5. Database migrations, replacing schema creation at startup

Each is tracked with its rationale in the
[technical debt register](docs/technical-debt.md).

## Architecture
The system follows a modular, component-based architecture:
- **Frontend:** React + TypeScript
- **Backend:** FastAPI (Python)
- **Database:** PostgreSQL
- **Infrastructure:** Docker + docker-compose

The backend package is laid out by responsibility under `backend/app/`: `api/`
(routers), `core/` (configuration and database session), `models/` (ORM models),
`schemas/` (request/response models), `services/` (block implementations and the
execution engine), and `tests/`.

Data flows through a workflow as a single value: each block receives whatever the
previous block returned. This keeps blocks independent and composable at the cost
of not supporting branching, which is recorded as technical debt.

## Repository Layout
```
backend/          FastAPI service (Dockerfile, requirements, app package)
frontend/         React + TypeScript app (Dockerfile, nginx config)
infrastructure/   docker-compose stack and environment template
docs/             Portfolio documentation
```

## Getting Started
See [docs/installation-run-instructions.md](docs/installation-run-instructions.md).

## Portfolio Documentation

**Getting started**

- [Installation & run instructions](docs/installation-run-instructions.md) — set up the stack and build a first workflow
- [API reference](docs/api-reference.md) — endpoints, block configurations, error semantics
- [Deployment notes](infrastructure/deployment-notes.md) — operating the stack

**Requirements**

- [Functional requirements](docs/requirements/functional.md) — with implementation status and test traceability
- [Non-functional requirements](docs/requirements/non-functional.md) — quality attributes and how far each holds
- [Glossary](docs/requirements/glossary.md) — domain vocabulary

**Design**

- [Architecture overview](docs/architecture/README.md) — context, style, components, cross-cutting concerns
- [Execution engine](docs/architecture/execution-engine.md) — block contract, data flow, outcome classification
- [Data model](docs/architecture/data-model.md) — entities, tables, JSON payload shapes
- [Deployment view](docs/architecture/deployment.md) — containers, configuration flow, startup ordering
- [Decision log](docs/architecture/decisions.md) — decisions with alternatives and consequences

**Process and reflection**

- [Methodology](docs/methodology.md) — approach, increments, verification strategy, quality gates
- [Technical debt register](docs/technical-debt.md) — known compromises and intended remedies
- [Lessons learned](docs/lessons-learned.md) — reflection on the outcome
