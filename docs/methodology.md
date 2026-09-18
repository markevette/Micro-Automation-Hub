# Methodology – Micro Automation Hub

> **Author's note:** this document describes the development approach as it is
> evidenced by the repository — the increments, the quality gates, and the
> decisions recorded in the architecture and technical debt documents. Adjust
> the process narrative in sections 1 and 2 to match the timeline and activities
> you actually followed.

## 1. Approach

The project followed a lightweight, iteration-based approach rather than a
phase-gated one. The scope — a small automation tool with a clear domain — made
a heavyweight process disproportionate, but the portfolio requirement to cover
the full lifecycle meant requirements, architecture, implementation, testing,
deployment, and reflection all had to be addressed explicitly rather than
implicitly.

The organising principle was the **vertical slice**: rather than completing the
data layer, then the API, then the interface, each increment delivered a thin
path through every layer so that the result was executable and could be judged
in practice. The alternative — building layer by layer — would have deferred all
integration risk to the end, which is precisely where a small project can least
afford it.

## 2. Increments

| Increment | Goal | Outcome |
|-----------|------|---------|
| 1 | Runnable skeleton | Containerised FastAPI service, PostgreSQL, and a React scaffold orchestrated by docker-compose, with health and readiness endpoints |
| 2 | Executable domain | Block library, sequential execution engine, persisted run history, and a REST API over them |
| 3 | Authoring | Visual builder: block palette, per-type configuration, reordering, test runs, create and update |

Each increment ended with the stack built and exercised end to end, not merely
with passing unit tests. Documentation was revised in the same increment as the
code it describes, which is why the requirements carry implementation status
rather than intent alone.

## 3. Requirements Engineering

Requirements were captured as identified, individually testable statements with
explicit acceptance criteria, split into
[functional](requirements/functional.md) and
[non-functional](requirements/non-functional.md) sets, with domain vocabulary
fixed in a [glossary](requirements/glossary.md) so the same word means the same
thing in the requirements, the architecture, and the code.

Two deliberate choices shaped the requirements documents:

- **Status is recorded per requirement.** Requirements that are unimplemented or
  only partly implemented say so. A requirements document that reads as though
  everything were finished is not a useful engineering artefact, and it makes
  the technical debt register redundant.
- **Requirements are traced to tests.** Each implemented requirement names the
  automated test that covers it, so the claim of completion is verifiable rather
  than asserted. The traceability table at the end of the functional
  requirements is the summary of that mapping.

## 4. Architecture and Design

Architecture was documented as a set of views — component structure, execution
behaviour, data model, and deployment — plus a log of the decisions that shaped
them, in [docs/architecture](architecture/README.md).

Decisions were recorded with their alternatives and consequences rather than as
bare conclusions, because the consequences are what later work has to live with.
The single-value data flow in the engine is the clearest example: it makes
blocks trivially composable and independently testable, and it is also the exact
reason conditional branching cannot be expressed. Recording that trade-off at
the point of decision is more useful than discovering it later.

## 5. Verification and Validation

Testing was targeted at the parts where defects were most likely and most
costly, rather than pursuing a coverage percentage.

**Test levels**

- *Unit* — path resolution and template rendering, including their failure
  messages, since these produce the errors users actually see.
- *Component* — the execution engine across all three outcomes, with the HTTP
  transport substituted so no test depends on the network.
- *Integration* — the REST API against a real database engine, using in-memory
  SQLite through a dependency override.
- *Frontend* — the builder and result views via the React Testing Library,
  driven through accessible roles and labels so tests assert on what a user can
  perceive rather than on implementation details.
- *System* — the composed stack built and executed end to end, confirming
  startup ordering, database connectivity, persistence across restart, and
  cross-origin behaviour.

**Design for testability.** Two seams were introduced specifically to make
testing possible without external dependencies: the HTTP transport is reached
through a module-level indirection, and the database session is a FastAPI
dependency. The generic JSON column type was chosen over a PostgreSQL-specific
one for the same reason — it permits the SQLite substitution.

**Negative testing.** Failure paths received at least as much attention as the
happy path: unreachable endpoints, HTTP error statuses, timeouts, missing
fields, oversized outputs, duplicate names, unknown block types, and an
unreachable database. Verifying that a filtered run is reported as `filtered`
rather than `failed` is a requirement in its own right, since conflating the two
would make correct automations look broken.

**Current state.** 27 backend tests and 15 frontend tests, all passing, with no
network or database dependency.

## 6. Quality Gates

The following had to hold before an increment was considered done:

1. Backend and frontend test suites pass.
2. The frontend compiles under TypeScript `strict` with no type errors.
3. Both container images build from a clean context.
4. The composed stack starts, and the database readiness endpoint reports
   success.
5. Documentation matches the implemented behaviour, including any newly created
   limitation.

Gate 5 is the one most easily skipped and was treated as blocking: when the
builder was added, the technical debt entry describing authoring as API-only was
not deleted but rewritten to describe what remained missing — no drag-and-drop,
no draft persistence, and hand-written rather than schema-generated forms.

## 7. Technical Debt Management

Debt was recorded as it was incurred rather than reconstructed afterwards, in a
[register](technical-debt.md) where each entry states the compromise and the
intended remedy. Entries arise from three sources: features consciously deferred
(scheduling, accounts), shortcuts taken to keep an increment shippable (schema
creation at startup instead of migrations), and limitations revealed by a design
decision (no branching, as a consequence of the single-value data flow).

Security is recorded as unmet rather than partially met. The API is
unauthenticated and the HTTP request block will call any URL it is given, which
together make the system unsuitable for public deployment; presenting that as a
minor gap would misrepresent it.

## 8. Tooling

| Concern | Tool | Rationale |
|---------|------|-----------|
| Backend | FastAPI, Pydantic, SQLAlchemy | Schema validation at the boundary and a typed ORM, with OpenAPI documentation generated from the same models |
| Frontend | React, TypeScript | Type safety across the API boundary via shared interface definitions |
| Database | PostgreSQL | Relational storage with a JSON column for the evolving workflow definition |
| Testing | pytest, Jest, React Testing Library | Dependency overrides and accessible-role queries |
| Packaging | Docker, docker-compose | Environment parity between development and deployment |
| Version control | Git | — |

## 9. Reflection

Outcomes are discussed in [lessons learned](lessons-learned.md). The
methodological conclusion is that the vertical-slice discipline was what made
the integration problems surface early — startup ordering against the database,
build-time versus runtime configuration in the frontend, and a lockfile that had
drifted out of sync with its manifest were all found by building and running the
whole stack, and none of them would have been caught by unit tests alone.
