# Functional Requirements – Micro Automation Hub

Each requirement carries an identifier, acceptance criteria, an honest
implementation status, and — where it is implemented — the automated test that
covers it. Terms are defined in the [glossary](glossary.md).

Status values:

- **Implemented** — built and covered by automated tests
- **Partial** — the mechanism exists but not every stated capability
- **Not implemented** — specified, deliberately out of scope for the current increment

---

## FR-1 Block Library

**Status: Implemented**

The system shall provide a library of configurable block types that can be
combined into an automation.

The five implemented types are:

| Type | Purpose | Key configuration |
|------|---------|-------------------|
| `http_request` | Call an HTTP endpoint and pass on the decoded JSON | `method` (GET/POST), `url`, `headers`, `body`, `timeout_seconds` |
| `json_extract` | Select named values out of the incoming data | `fields`: output name → dotted path |
| `filter` | Stop the run unless a condition holds | `path`, `operator`, `value` |
| `text_transform` | Render a template and adjust casing | `template`, `operation` |
| `notification` | Emit a rendered message | `channel`, `template` |

**Acceptance criteria**

1. Each block type validates its own configuration; unknown block types and
   unknown configuration keys are rejected.
2. `filter` supports the operators `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, and
   `contains`. Ordering operators require numeric operands and report a clear
   error otherwise.
3. `text_transform` supports the operations `none`, `upper`, `lower`, `strip`.
4. Dotted paths address both object keys and list indices.

*Verified by* `test_blocks.py`, and `test_invalid_block_type_is_rejected`.

---

## FR-2 Workflow Composition

**Status: Implemented**

A user shall be able to compose a workflow from blocks through the web
interface, without writing JSON by hand.

**Acceptance criteria**

1. Available block types are presented as a palette derived from the block
   catalogue, not hardcoded in the frontend's markup.
2. A block can be added, renamed, reordered, and removed.
3. Each block offers input controls appropriate to its type — a method
   dropdown, an operator dropdown, key/value editors for maps — rather than a
   raw text field.
4. A workflow cannot be saved without a name and at least one block.
5. Filter values entered as text are submitted as the corresponding JSON type,
   so `1000` compares numerically rather than as a string.

*Verified by* `WorkflowBuilder.test.tsx` (palette rendering, add, reorder,
remove, save-button gating, submitted payload shape).

---

## FR-3 Workflow Persistence

**Status: Implemented**

Workflows shall be stored durably and remain available across restarts.

**Acceptance criteria**

1. A workflow can be created, listed, retrieved, updated, and deleted.
2. Workflow names are unique; a colliding name is rejected with HTTP 409 on
   both create and update.
3. Deleting a workflow also removes its run history.
4. Stored workflows survive container recreation.

*Verified by* `test_create_then_list_workflow`,
`test_duplicate_name_is_rejected`, `test_updating_a_workflow_replaces_its_definition`,
`test_updating_to_an_existing_name_is_rejected`, `test_deleting_a_workflow_removes_it`.

---

## FR-4 Sequential Workflow Execution

**Status: Implemented**

The system shall execute a workflow's blocks in the order defined, passing each
block's output to the next.

**Acceptance criteria**

1. Blocks execute strictly in order, first to last.
2. The first block receives no input value.
3. Execution stops at the first block that fails or filters the run out;
   subsequent blocks are not executed.
4. A defect in a single block cannot terminate the API process — an unexpected
   exception is recorded as a block failure.

*Verified by* `test_full_pipeline_succeeds_and_records_every_step`,
`test_filter_stops_the_run_and_skips_later_blocks`.

---

## FR-5 Outcome Classification

**Status: Implemented**

Every run shall be classified so that a workflow which correctly had nothing to
do is distinguishable from one that malfunctioned.

**Acceptance criteria**

1. A run ends as exactly one of `success`, `failed`, or `filtered`.
2. An unmet filter condition yields `filtered`, never `failed`.
3. A failed run reports which block failed and why.

*Verified by* `test_http_error_status_fails_the_run`,
`test_timeout_is_reported_as_a_block_failure`,
`test_missing_field_fails_with_a_useful_message`.

---

## FR-6 Run History

**Status: Implemented**

Each execution shall be recorded with enough detail to explain what happened.

**Acceptance criteria**

1. A run records its overall status, start time, and total duration.
2. Each executed block records its name, type, status, duration, log lines, and
   output.
3. History can be listed most-recent-first and filtered by workflow, with a
   bounded page size.
4. Run history is preserved across a backend restart.
5. Individual step outputs are prevented from growing without limit.

*Verified by* `test_running_a_workflow_records_run_history`,
`test_large_output_is_truncated_before_storage`.

---

## FR-7 Block Introspection

**Status: Implemented**

The system shall publish the available block types and the schema of their
configuration, so that a client can present them without duplicating knowledge
of the block library.

**Acceptance criteria**

1. `GET /api/blocks` returns every implemented type with a label, a description,
   and a JSON Schema for its configuration.

*Verified by* `test_block_catalog_exposes_every_type_with_a_config_schema`, and
the builder's `renders the block palette from the API catalogue`.

> Note: the endpoint is complete, but the builder currently renders hand-written
> forms per block type rather than generating them from the published schema.
> Recorded as item 8 in the [technical debt register](../technical-debt.md).

---

## FR-8 Ad-hoc Execution

**Status: Implemented**

A user shall be able to execute a definition without saving it first, in order
to iterate while composing.

**Acceptance criteria**

1. A definition can be executed directly and returns the same per-step detail as
   a saved workflow run.
2. Such runs appear in the history with no associated workflow.
3. Testing a draft does not create a workflow.

*Verified by* `test_ad_hoc_run_is_recorded_without_a_workflow`, and the builder's
`a test run shows the per-block result without saving`.

---

## FR-9 Result Inspection

**Status: Implemented**

Execution results shall be presented so that a non-technical user can see where
a run went and why it stopped.

**Acceptance criteria**

1. Each block is shown in order with a status indication, its duration, its log
   lines, and its output.
2. The overall outcome is shown prominently.
3. When a run stopped early, the interface states that the remaining blocks did
   not run.
4. Past runs can be selected from the history and re-inspected.

*Verified by* the builder's `a test run shows the per-block result without
saving`, which exercises the per-block result view, and `App.test.tsx` for the
workflow list and error surfacing.

> Coverage gap: criterion 4 — selecting a past run from the history panel — is
> implemented and was confirmed by hand during end-to-end testing, but has no
> automated test.

---

## FR-10 Service Health Reporting

**Status: Implemented**

The system shall report its own health in a way that separates process failure
from dependency failure.

**Acceptance criteria**

1. A liveness endpoint answers successfully without touching the database.
2. A readiness endpoint reports HTTP 503 when the database is unreachable.
3. The API starts and serves the liveness endpoint even if the database is down
   at startup.

*Verified by* `test_health_check_reports_ok`,
`test_database_health_check_reports_503_when_database_is_unreachable`.

---

## FR-11 Notification Delivery

**Status: Partial**

The system shall notify the user of an automation's result.

Implemented: rendering a message from the run data and emitting it to the
application log, where it is visible via `docker compose logs`.

Not implemented: email delivery. The SMTP settings in `env.example` are passed
to the container but unused, and the builder marks the channel selector as
unavailable. Recorded as item 7 in the technical debt register.

---

## FR-12 Scheduled and Triggered Execution

**Status: Not implemented**

Workflows shall run automatically on a schedule or in response to an event.

Execution is currently manual only, via the interface or the API. Recorded as
item 1 in the technical debt register.

---

## FR-13 Accounts and Access Control

**Status: Not implemented**

Users shall authenticate, and workflows shall belong to their owner.

There is no authentication of any kind: every endpoint is public and workflows
are global rather than per-user. This is the most significant gap against the
original scope and is recorded as items 4 and 10 in the technical debt register.
It also means the `http_request` block will call any URL it is given, which
would make a public deployment abusable as a request proxy.

---

## FR-14 Conditional Branching

**Status: Not implemented**

A workflow shall be able to take different paths depending on intermediate
results.

The engine passes a single value along a linear chain, so branches, loops, and
fan-out are not expressible. `filter` can only stop a run, not divert it.
Recorded as item 9 in the technical debt register.

---

## Traceability Summary

| Requirement | Status | Primary test coverage |
|-------------|--------|-----------------------|
| FR-1 Block library | Implemented | `test_blocks.py` |
| FR-2 Workflow composition | Implemented | `WorkflowBuilder.test.tsx` |
| FR-3 Workflow persistence | Implemented | `test_workflows_api.py` |
| FR-4 Sequential execution | Implemented | `test_engine.py` |
| FR-5 Outcome classification | Implemented | `test_engine.py` |
| FR-6 Run history | Implemented | `test_workflows_api.py`, `test_engine.py` |
| FR-7 Block introspection | Implemented | `test_workflows_api.py` |
| FR-8 Ad-hoc execution | Implemented | `test_workflows_api.py`, `WorkflowBuilder.test.tsx` |
| FR-9 Result inspection | Implemented | `App.test.tsx` |
| FR-10 Health reporting | Implemented | `test_health.py` |
| FR-11 Notification delivery | Partial | `test_engine.py` (log channel only) |
| FR-12 Scheduling | Not implemented | — |
| FR-13 Accounts and access control | Not implemented | — |
| FR-14 Conditional branching | Not implemented | — |
