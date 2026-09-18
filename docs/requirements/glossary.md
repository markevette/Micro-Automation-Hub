# Glossary – Micro Automation Hub

Domain terms used throughout the requirements, architecture, and code. Where a
term maps directly onto an identifier in the source, that identifier is given.

| Term | Meaning |
|------|---------|
| **Automation** | Informal, user-facing word for a workflow. Used in the product name and UI copy; the code always says "workflow". |
| **Workflow** | A named, saved sequence of blocks that can be executed repeatedly. Persisted in the `workflows` table. |
| **Workflow definition** | The executable content of a workflow: an ordered list of blocks. Validated as `WorkflowDefinition` and stored as JSON so it can change shape without a schema migration. Limited to 1–20 blocks. |
| **Block** | One configurable step in a workflow. Has a `type`, a human-readable `name` (1–80 characters), and a `config` whose shape is determined by the type. |
| **Block type** | One of the five implemented kinds of block: `http_request`, `json_extract`, `filter`, `text_transform`, `notification`. Modelled as a Pydantic discriminated union on the `type` field, so an unknown type is rejected with HTTP 422. |
| **Block config** | The type-specific settings of a block, e.g. `url` and `timeout_seconds` for `http_request`. Each type has its own config model, and unknown keys are rejected. |
| **Block catalogue** | The list of available block types with their labels, descriptions, and JSON config schemas, served by `GET /api/blocks`. The builder's palette is rendered from it. |
| **Block handler** | The function that implements a block type's behaviour, registered in the `HANDLERS` map. Takes `(config, value, logs)` and returns the next value. |
| **Execution engine** | The component that runs a definition's blocks in order and produces a run outcome. Implemented in `app/services/engine.py`. |
| **Value** | The single piece of data passed from one block to the next. The first block receives `None`. There is no named multi-variable context, which is why branching is not expressible. |
| **Run** | One execution of a workflow, recorded permanently with its outcome and per-block detail. Persisted in the `workflow_runs` table. |
| **Ad-hoc run** | A run of a definition that was never saved as a workflow, submitted to `POST /api/runs/ad-hoc`. Recorded in the history with `workflow_id` set to null. Used by the builder's **Test run** button. |
| **Step** | The record of one block's execution within a run: its name, type, status, duration, logs, and output. Represented as `StepResult`. |
| **Step output** | The value a block produced. Stored in the run history, summarised if it would exceed 2000 characters when encoded as JSON. |
| **Truncated output** | A placeholder object (`_truncated`, `size_chars`, `preview`) stored instead of an oversized step output, so run history stays bounded. |
| **Run status** | The outcome of a run: exactly one of `success`, `failed`, or `filtered`. |
| **`success`** | Every block ran without error. |
| **`failed`** | A block raised an error, e.g. an unreachable endpoint, an HTTP status of 400 or above, a timeout, or a missing field. |
| **`filtered`** | A filter block's condition did not hold, so execution stopped deliberately. Distinct from `failed`: the workflow behaved correctly and simply had nothing to do. |
| **Step status** | The same three values, applied to an individual block. Only the final step of a non-successful run is `failed` or `filtered`. |
| **Skipped blocks** | Blocks after the stopping point of a `failed` or `filtered` run. They are not executed and produce no step records, which is why such runs show fewer steps than the workflow has blocks. |
| **Dotted path** | A reference into nested incoming data, used by `json_extract` and `filter`. Segments are object keys or list indices, e.g. `owner.login` or `items.0.id`. |
| **Template** | A string with `{placeholder}` references, used by `text_transform` and `notification`. Placeholders resolve against the keys of the incoming value; `{input}` always refers to the whole incoming value. |
| **Draft** | A workflow being composed in the builder but not yet saved. Held in browser state only, so it is lost on reload. |
| **Liveness check** | `GET /health`. Confirms the API process is running. Deliberately does not touch the database, so the service can report itself up while the database is down. |
| **Readiness check** | `GET /health/db`. Confirms the database is reachable, returning 503 when it is not. Used to distinguish "API broken" from "database unavailable". |
| **Block palette** | The builder's list of addable block types, rendered from the block catalogue. |
