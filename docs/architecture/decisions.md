# Decision Log

The design decisions that shaped the system, each with the alternatives
considered and the consequences accepted. Consequences are recorded because they
are what subsequent work has to live with — several entries below are the direct
origin of items in the [technical debt register](../technical-debt.md).

---

## AD-1 Modular Monolith Rather Than Services

**Context.** The domain has three closely related concepts — workflows, blocks,
runs — and one workload.

**Decision.** A single backend process with responsibilities separated into
packages, enforced by a one-directional dependency flow.

**Alternatives.** Separate services for authoring and execution, which would
allow the execution tier to scale independently.

**Consequences.** No network boundaries, no partial-failure handling, and one
deployment artefact. Modularity is a convention rather than a physical
constraint, so it depends on discipline. Independent scaling of execution is
unavailable; given that runs are short and synchronous, it is not yet needed.

---

## AD-2 Single-Value Linear Data Flow

**Context.** Blocks must pass data to one another.

**Decision.** Each block receives exactly one value — the previous block's
output — and returns one value. No named context.

**Alternatives.** A named context dictionary that every block can read from and
write to, or a directed graph with explicit input references per block.

**Consequences.** Blocks are trivially composable and independently testable,
and a workflow is a plain list, which keeps both the UI and the stored
definition simple. The cost is severe and accepted deliberately: **branching,
loops, and fan-out cannot be expressed**, and no block can reference a result
from more than one step back. This is the single decision most likely to be
revisited, and it is the origin of technical debt item 9.

---

## AD-3 Filters Gate Rather Than Branch, and `filtered` Is Not `failed`

**Context.** A workflow frequently needs to proceed only under some condition.

**Decision.** A filter either passes its input through unchanged or stops the
run, and a stopped run is recorded with its own status, `filtered`, distinct
from `failed`.

**Alternatives.** Treating an unmet condition as a failure, which is simpler;
or true conditional branching, which AD-2 precludes.

**Consequences.** A workflow that correctly determined there was nothing to do
is distinguishable from one that malfunctioned — which matters, because
conflating them would train users to ignore failures. Because filters do not
transform data, adding or removing one never disturbs the blocks after it. The
engine, the API, and the UI all carry the three-state vocabulary.

---

## AD-4 The Engine Does Not Touch the Database

**Context.** A run must be persisted, and the engine must be testable.

**Decision.** `execute_workflow` accepts a validated definition and returns an
outcome. Persisting it is the router's responsibility.

**Alternatives.** Having the engine write its own run record, which would keep
the router thinner.

**Consequences.** The engine is a pure function of its input, so all three
outcome paths can be tested exhaustively with no database. The transaction
boundary sits in one place, the router. A run is written in a single insert after
completion, which means **there is no progress reporting for an in-flight run** —
acceptable while runs are short and synchronous.

---

## AD-5 JSON Columns for Definitions and Run Steps

**Context.** Block configuration differs per type and will grow as types are
added.

**Decision.** Store the workflow definition and the run's step records as JSON
columns.

**Alternatives.** Normalised tables — a row per block, with either sparse
nullable configuration columns or a table per block type.

**Consequences.** A new block type needs no migration. Run steps, which are an
append-only record always read in full, are not pointlessly decomposed. The cost
is that **the database cannot query inside a definition**: "which workflows call
this host?" requires application-side inspection of every row. At this scale
that is acceptable; the remedy if it stops being so is a derived index table,
not restructuring the definition. See [data model](data-model.md#5-why-json-rather-than-normalised-tables).

---

## AD-6 Generic `JSON` Rather Than PostgreSQL `JSONB`

**Context.** The application targets PostgreSQL, but the test suite should not
require it.

**Decision.** Use SQLAlchemy's portable `JSON` type.

**Alternatives.** `JSONB`, which supports indexing and querying within the
document.

**Consequences.** The models work unchanged on SQLite, which is what allows the
API tests to run against an in-memory database with no PostgreSQL instance and
no fixtures. The forfeited capability — indexed querying inside the document —
was already ruled out by AD-5, so this costs nothing additional today. Adopting
`JSONB` later would mean a migration and losing the SQLite test path.

---

## AD-7 Block Types as a Discriminated Union

**Context.** A submitted definition may contain any mix of block types, each
with a different configuration shape.

**Decision.** Model blocks as a Pydantic discriminated union keyed on `type`,
with each type's configuration forbidding unknown keys.

**Alternatives.** A single block model with a free-form `config` dictionary
validated inside each handler.

**Consequences.** An unknown block type or a misspelled configuration key is
rejected at the HTTP boundary with a precise 422, before any execution begins.
The engine can assume well-formed input and does not re-validate. Config schemas
become machine-readable for free, which is what `GET /api/blocks` publishes.

---

## AD-8 Seams Introduced for Testability

**Context.** Block execution calls the network; the API calls a database.
Neither should be required to run tests.

**Decision.** Reach the HTTP transport through a module-level indirection, and
provide the database session as a FastAPI dependency.

**Alternatives.** Patching `requests` directly in tests, or running a real
database in the test environment.

**Consequences.** Tests substitute a fake transport and an in-memory database
through supported mechanisms rather than by monkey-patching third-party
internals, so they do not break when those internals change. The cost is one
extra level of indirection in production code, documented at the definition
site.

---

## AD-9 Multi-Stage Frontend Build Served by nginx

**Context.** The frontend needs to be served in a container.

**Decision.** Build the static bundle in a Node stage, then copy only the output
into an nginx image.

**Alternatives.** Running the Create React App development server in the
container, which is what the project did initially.

**Consequences.** The runtime image is roughly **75 MB** instead of **3 GB**, and
contains no Node.js, no `node_modules`, and no dev server. It also forces the
consequence in AD-10. nginx needs explicit SPA fallback configuration so
client-side routes survive a refresh.

---

## AD-10 The Browser Calls the API Directly

**Context.** nginx serves the frontend; the API is a separate container.

**Decision.** Serve static assets only from nginx and have the browser call the
backend directly at a configured base URL.

**Alternatives.** Proxying `/api` through nginx to the backend, giving the
browser a single origin.

**Consequences.** Cross-origin configuration becomes load-bearing: the frontend
and backend URLs must agree with `BACKEND_CORS_ORIGINS` or the application shows
empty data with nothing wrong in the backend logs. Combined with Create React
App inlining variables at build time, it also means **`REACT_APP_API_URL` is
fixed when the image is built**, so changing the backend location requires a
rebuild. This is documented prominently because it is the most common
deployment mistake with this stack. Proxying would remove both problems and is
worth reconsidering.

---

## AD-11 Stored Step Outputs Are Summarised

**Context.** Step outputs are persisted, and an HTTP response can be arbitrarily
large.

**Decision.** Replace any stored output exceeding 2000 encoded characters with a
summary containing its size and a short preview.

**Alternatives.** Storing outputs in full, or not storing them at all.

**Consequences.** Run history stays bounded per run without losing the ability
to see what a block produced. Crucially, summarisation affects only the stored
copy — the full value is always passed to the next block, so truncation never
changes what a workflow computes. Unserialisable values are also summarised,
which means a strange value can never fail the insert that records the run.

---

## AD-12 Schema Created at Startup Instead of Migrated

**Context.** The database needs tables, and the project had no migration tool.

**Decision.** Call `create_all()` during application startup, wrapped so an
unreachable database only logs a warning.

**Alternatives.** Introducing Alembic immediately.

**Consequences.** The stack is runnable from a clean checkout with no migration
step, which suits evaluation. But `create_all` never alters existing tables, so
**a model change requires discarding the volume** — unacceptable for anything
holding real data. Accepted knowingly and recorded as technical debt item 6; the
startup call should be removed once Alembic is adopted.

---

## AD-13 Hand-Written Configuration Forms

**Context.** `GET /api/blocks` publishes a JSON Schema for each block type's
configuration, so the builder could in principle generate its forms.

**Decision.** Write a configuration form per block type by hand.

**Alternatives.** A generic JSON-Schema-driven form renderer.

**Consequences.** Controls fit their data — an operator dropdown, key/value rows
for maps, a method selector, numeric bounds on the timeout — which a generic
renderer would struggle to match for nested maps and mixed-type values. The cost
is a duplicated source of truth: **adding a block type now requires a frontend
change as well as a backend one**. Recorded as technical debt item 8. The
catalogue endpoint is still used for the palette, so the duplication is confined
to the configuration forms.

---

## AD-14 Reordering by Buttons Rather Than Dragging

**Context.** Block order determines execution order, so the builder must allow
rearrangement.

**Decision.** Move blocks with up and down controls.

**Alternatives.** Drag-and-drop, either via a library or the native HTML5 API.

**Consequences.** No new dependency — which also avoids peer-dependency
friction with the current React version — and the interaction is keyboard
operable and screen-reader friendly by default, whereas drag-and-drop needs
deliberate work to become accessible. For long workflows dragging would be
faster, and the 20-block ceiling keeps that cost bounded. Recorded as part of
technical debt item 8.
