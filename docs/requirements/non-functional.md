# Non-Functional Requirements – Micro Automation Hub

Quality requirements, each with the concrete mechanism that implements it and an
honest assessment of how far it currently holds. Where a requirement is only
partly met, the gap is stated rather than glossed over.

---

## NFR-1 Reliability Against Untrusted Endpoints

**Requirement.** A workflow calls endpoints the system does not control. A slow,
broken, or hostile endpoint must not destabilise the service.

**Mechanism.**

- Every HTTP request carries a timeout, defaulting to 10 seconds and capped by
  validation at 60, so a hanging endpoint cannot stall a run indefinitely.
- Non-2xx responses, connection failures, and timeouts are converted into block
  failures rather than propagating as unhandled exceptions.
- A response that is not JSON is passed on as text instead of failing the run.
- The engine catches unexpected exceptions from any handler, so a defect in one
  block degrades that run rather than the API process.

**Status.** Met. No retry or circuit-breaker behaviour exists, so a transient
failure fails the run; recorded as a gap in the technical debt register.

---

## NFR-2 Observability

**Requirement.** When an automation does not do what the user expected, the
system must be able to explain why.

**Mechanism.**

- Every executed block records its status, duration, and log lines, persisted
  with the run rather than only written to stdout.
- Block handlers log the decisions they made — the request issued and status
  received, the fields extracted, the comparison performed with both operands
  and the boolean result.
- Failures name the offending block and the reason; path errors name the missing
  key, and template errors list the placeholders that were available.
- The engine also logs to the application log at `INFO` for filtered runs and
  `WARNING` for failures.

**Status.** Met.

---

## NFR-3 Bounded Resource Growth

**Requirement.** Run history accumulates indefinitely and must not grow without
limit per run.

**Mechanism.**

- A step output larger than 2000 characters when JSON-encoded is replaced with a
  summary recording its size and a 500-character preview.
- A workflow definition is limited to 20 blocks, bounding the work one run can do.
- Run history queries are paginated with a default of 20 and a hard maximum of
  100 records.
- `workflow_runs.workflow_id` and `status` are indexed, so filtering history
  does not degrade into a full scan.

**Status.** Met per run. There is no retention policy, so total history grows
without bound over time — a real deployment would need periodic pruning.

---

## NFR-4 Portability

**Requirement.** The system must run identically on a developer machine and on a
cloud host, without code changes.

**Mechanism.**

- Both services are containerised and orchestrated by a single compose file.
- All environment-specific values — database URL, allowed origins, host ports,
  API base URL — are supplied as environment variables with sensible defaults.
- The database is reached by service name on the compose network, so the host
  port mapping is irrelevant to the application.

**Status.** Met. One caveat is documented prominently: `REACT_APP_API_URL` is
inlined into the frontend bundle at build time, so changing it requires a
rebuild rather than a restart.

---

## NFR-5 Reproducibility

**Requirement.** The same source must produce the same dependency set on every
build.

**Mechanism.**

- Python dependencies are pinned to compatible releases in `requirements.txt`.
- The frontend installs with `npm ci` against a committed lockfile, which fails
  loudly if the lockfile and manifest disagree rather than silently resolving
  something different.
- `.dockerignore` files keep host artefacts — `node_modules`, virtualenvs,
  caches — out of the build context, so a build cannot be contaminated by
  platform-specific binaries from the developer's machine.

**Status.** Met.

---

## NFR-6 Maintainability

**Requirement.** The codebase must remain understandable and safe to change.

**Mechanism.**

- The backend is separated by responsibility: routers, configuration and
  database session, ORM models, request/response schemas, and services holding
  the block handlers and the engine.
- Adding a block type requires a config model, a handler, and two registry
  entries; the engine itself does not change.
- Block types are a discriminated union, so the API rejects an unknown type at
  the boundary rather than failing deeper in the engine.
- The frontend separates the API client, block metadata, and presentation
  components.

**Status.** Met on the backend. Partly met on the frontend: a new block type
also requires a hand-written configuration form, because the builder does not
yet generate forms from the published schema.

---

## NFR-7 Testability

**Requirement.** Behaviour must be verifiable without external dependencies.

**Mechanism.**

- The HTTP transport is injected through a module-level indirection, so engine
  tests substitute it and never touch the network.
- The database session is a FastAPI dependency, so API tests override it with
  in-memory SQLite and need no running database.
- The JSON column type is used rather than a PostgreSQL-specific type, which is
  what allows the SQLite substitution.
- Test clients are constructed without triggering application startup, so tests
  do not attempt to reach PostgreSQL.

**Status.** Met. 27 backend tests and 15 frontend tests run with no network and
no database.

---

## NFR-8 Data Durability

**Requirement.** Saved workflows and run history must survive the container
lifecycle.

**Mechanism.**

- PostgreSQL stores its data directory on a named volume, so stopping and
  recreating containers preserves it. Only an explicit `docker compose down -v`
  discards it.
- The backend waits for the database to pass a `pg_isready` healthcheck before
  starting, rather than merely waiting for the container to exist.

**Status.** Met. There is no backup, and no migration tooling — the schema is
created at startup, so changing a model currently requires discarding the
volume.

---

## NFR-9 Usability

**Requirement.** A non-technical user must be able to build and understand an
automation.

**Mechanism.**

- Blocks are chosen from a palette that carries a plain-language label and
  description for each type.
- Configuration uses appropriate controls — dropdowns for fixed choices,
  key/value rows for maps — and inline hints explain dotted paths and template
  placeholders.
- A draft can be test-run before being saved, so mistakes are cheap.
- Results are shown as an ordered, colour-coded timeline, and a run that stopped
  early says so explicitly instead of silently showing fewer blocks.
- Interactive controls carry accessible labels, and reordering uses buttons
  rather than drag-only interaction, which keeps it keyboard-operable.

**Status.** Partly met. The interface is usable and accessible for composition
and inspection, but no usability testing with real users has been conducted, and
drafts are lost on page reload.

---

## NFR-10 Security

**Requirement.** The system must not expose its data or its host to misuse.

**Mechanism.**

- Cross-origin access is restricted to an explicit list of allowed origins
  rather than a wildcard, verified by observing that a foreign origin receives
  no allow header.
- The backend container runs as a non-root user.
- Request bodies are validated by schema at the boundary, and unknown fields on
  a block are rejected.
- Database credentials are supplied as environment variables and never
  committed; `env.example` is a template and `.env` is ignored by git.

**Status. Not met — this is the system's most serious limitation.**

Specifically:

1. **No authentication.** Every endpoint is public. Anyone who can reach the API
   can read, modify, delete, and execute all workflows.
2. **Server-side request forgery.** The `http_request` block will call any URL it
   is given, from inside the container network. A public deployment could be used
   to reach internal services or as an anonymising request proxy. There is no
   outbound allow-list.
3. **No transport security.** The stack terminates plain HTTP; TLS would have to
   be provided by a reverse proxy or the hosting platform.
4. **Default credentials.** The compose defaults exist so the stack boots for
   evaluation, which means an operator who does not create a `.env` runs with a
   known password.

The system is therefore suitable for local evaluation only. Items 4 and 10 of the
[technical debt register](../technical-debt.md) track the required work.

---

## Summary

| ID | Requirement | Status |
|----|-------------|--------|
| NFR-1 | Reliability against untrusted endpoints | Met (no retries) |
| NFR-2 | Observability | Met |
| NFR-3 | Bounded resource growth | Met per run; no retention policy |
| NFR-4 | Portability | Met |
| NFR-5 | Reproducibility | Met |
| NFR-6 | Maintainability | Met (backend); partial (frontend) |
| NFR-7 | Testability | Met |
| NFR-8 | Data durability | Met; no backups or migrations |
| NFR-9 | Usability | Partial; no user testing |
| NFR-10 | Security | **Not met — local evaluation only** |
