# API Reference – Micro Automation Hub

The backend generates interactive documentation from the same models that
validate requests, available at <http://localhost:8000/docs> while the stack is
running. This document is the written companion: it covers the request and
response shapes, the block configurations, and the error semantics.

Base URL in the default local stack: `http://localhost:8000`. There is **no
authentication** — see [NFR-10](requirements/non-functional.md#nfr-10-security).

---

## 1. Endpoints

| Method | Path | Purpose | Success |
|--------|------|---------|---------|
| `GET` | `/health` | Liveness; does not touch the database | 200 |
| `GET` | `/health/db` | Readiness; 503 when the database is unreachable | 200 |
| `GET` | `/api/blocks` | Block catalogue with config schemas | 200 |
| `POST` | `/api/workflows` | Create a workflow | 201 |
| `GET` | `/api/workflows` | List all workflows, oldest first | 200 |
| `GET` | `/api/workflows/{id}` | Retrieve one workflow | 200 |
| `PUT` | `/api/workflows/{id}` | Replace a workflow's name, description, and definition | 200 |
| `DELETE` | `/api/workflows/{id}` | Delete a workflow and its run history | 204 |
| `POST` | `/api/workflows/{id}/run` | Execute a saved workflow | 200 |
| `POST` | `/api/runs/ad-hoc` | Execute a definition without saving it | 200 |
| `GET` | `/api/runs` | List runs, newest first | 200 |
| `GET` | `/api/runs/{id}` | Retrieve one run | 200 |

`PUT` is a full replacement, not a patch: every field must be supplied, and the
definition given replaces the stored one entirely.

`GET /api/runs` accepts two query parameters:

| Parameter | Type | Default | Notes |
|-----------|------|---------|-------|
| `workflow_id` | integer | — | Omit to include ad-hoc runs alongside saved ones |
| `limit` | integer | 20 | Between 1 and 100 inclusive |

---

## 2. Workflows

### Request body — create and update

```json
{
  "name": "GitHub repo watcher",
  "description": "Alert when a repository passes a star threshold",
  "definition": { "blocks": [ /* 1 to 20 blocks */ ] }
}
```

| Field | Constraint |
|-------|------------|
| `name` | 1–120 characters, unique across all workflows |
| `description` | Optional, defaults to empty |
| `definition.blocks` | 1–20 blocks |

### Response body

```json
{
  "id": 1,
  "name": "GitHub repo watcher",
  "description": "Alert when a repository passes a star threshold",
  "definition": { "blocks": [ /* ... */ ] },
  "created_at": "2026-09-13T08:12:44.918273Z"
}
```

---

## 3. Blocks

Every block has the same envelope. `type` selects which configuration shape is
valid, and **unknown fields are rejected** — a misspelled key is a 422, not a
silently ignored setting.

```json
{ "type": "http_request", "name": "Fetch repository", "config": { "url": "..." } }
```

`name` is 1–80 characters and is what identifies the block in run history and in
error messages, so it is worth making it descriptive.

### `http_request` — HTTP Request

Calls an HTTP endpoint and passes on the decoded JSON response.

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `method` | `"GET"` \| `"POST"` | `"GET"` | |
| `url` | string | *required* | |
| `headers` | object of strings | `{}` | |
| `body` | any | `null` | Sent as JSON on `POST` |
| `timeout_seconds` | number | `10.0` | Greater than 0, at most 60 |

Passes on the decoded JSON body. A non-JSON response is passed on as
`{"text": "..."}` rather than failing. A status of 400 or above fails the run.

### `json_extract` — Extract Fields

Picks named values out of the incoming object using dotted paths. Usually placed
straight after an HTTP request, whose response is typically far larger than
needed.

| Field | Type | Notes |
|-------|------|-------|
| `fields` | object of strings | Output name → dotted path; at least one entry |

```json
{ "fields": { "repo": "full_name", "owner": "owner.login", "stars": "stargazers_count" } }
```

Path segments address object keys or list indices, e.g. `items.0.id`. A path that
does not resolve fails the run with a message naming the segment at fault.

### `filter` — Filter

Stops the run unless a condition on the incoming data holds.

| Field | Type | Notes |
|-------|------|-------|
| `path` | string | Dotted path into the incoming value |
| `operator` | enum | `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `contains` |
| `value` | any | Compared against the value at `path` |

```json
{ "path": "stars", "operator": "gt", "value": 1000 }
```

Passes its input through **unchanged**, so inserting or removing a filter never
disturbs the blocks after it. An unmet condition ends the run as `filtered`, not
`failed`. Ordering operators require numeric operands — note that `1000` and
`"1000"` are not interchangeable here.

### `text_transform` — Text Transform

Renders a template from the incoming data and adjusts casing.

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `template` | string | *required* | `{placeholder}` references |
| `operation` | enum | `"none"` | `none`, `upper`, `lower`, `strip` |

```json
{ "template": "{repo} has {stars} stars", "operation": "none" }
```

Placeholders resolve against the keys of the incoming value when it is an object.
`{input}` always refers to the whole incoming value, which is what to use once a
previous block has reduced the data to a single string. An unknown placeholder
fails the run, and the error lists the names that *were* available.

### `notification` — Notification

Emits a rendered message.

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `channel` | `"log"` | `"log"` | Only the log channel is implemented |
| `template` | string | *required* | Same placeholder rules as above |

Returns `{"channel": "log", "message": "..."}`. The message is written to the
application log, visible via `docker compose logs backend`. Email is not
implemented — see item 7 of the [technical debt register](technical-debt.md).

---

## 4. Runs

Both run endpoints return the same shape, whether the definition was saved or
ad-hoc.

```json
{
  "id": 42,
  "workflow_id": 1,
  "status": "filtered",
  "started_at": "2026-09-13T08:20:11.004312Z",
  "duration_ms": 231,
  "error": "condition not met: stars gt 1000",
  "steps": [
    {
      "name": "Fetch repository",
      "type": "http_request",
      "status": "success",
      "output": { "_truncated": true, "size_chars": 48213, "preview": "{\"full_name\": ..." },
      "error": null,
      "duration_ms": 214,
      "logs": ["GET https://api.github.com/repos/fastapi/fastapi", "responded 200"]
    },
    {
      "name": "Only when popular",
      "type": "filter",
      "status": "filtered",
      "output": null,
      "error": "condition not met: stars gt 1000",
      "duration_ms": 0,
      "logs": ["stars (842) gt 1000 -> False"]
    }
  ]
}
```

Three details matter when consuming this:

- `workflow_id` is `null` for ad-hoc runs.
- **`steps` contains only the blocks that actually executed.** A `failed` or
  `filtered` run stops at the offending block, so the array is shorter than the
  workflow's block list. Compare against the definition to know what was skipped.
- A step `output` may have been replaced by a summary if it exceeded 2000
  encoded characters. Truncation affects only the stored copy — the next block
  always received the full value.

On a `failed` run the run-level `error` is prefixed with the failing block's
name, so a history list can convey the cause without expanding the run. On a
`filtered` run it carries the unmet condition without a prefix; the block
responsible is the last entry in `steps`.

---

## 5. Errors

| Status | Meaning | Body |
|--------|---------|------|
| 404 | Unknown workflow or run | `{"detail": "workflow not found"}` |
| 409 | Workflow name already taken | `{"detail": "a workflow named 'X' already exists"}` |
| 422 | Request failed validation | FastAPI's `detail` array, one entry per problem |
| 503 | Database unreachable (`/health/db` only) | `{"detail": "database unavailable"}` |

A 422 lists each problem with the path to the offending field:

```json
{
  "detail": [
    {
      "loc": ["body", "definition", "blocks", 0, "config", "url"],
      "msg": "Field required",
      "type": "missing"
    }
  ]
}
```

The frontend's API client flattens these into single-line messages, since the
raw array is not useful in an interface.

**A block failing is not an HTTP error.** A run whose blocks failed still returns
200 with `status: "failed"` — the request to execute succeeded, and the outcome
is in the payload. Only malformed requests produce 4xx responses.

---

## 6. Worked Example

Create a workflow, run it, then read its history.

```bash
curl -X POST http://localhost:8000/api/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Star watcher",
    "description": "Report a repository star count",
    "definition": {"blocks": [
      {"type": "http_request", "name": "Fetch repo",
       "config": {"url": "https://api.github.com/repos/fastapi/fastapi"}},
      {"type": "json_extract", "name": "Keep fields",
       "config": {"fields": {"repo": "full_name", "stars": "stargazers_count"}}},
      {"type": "filter", "name": "Only when popular",
       "config": {"path": "stars", "operator": "gt", "value": 1000}},
      {"type": "text_transform", "name": "Summarise",
       "config": {"template": "{repo} has {stars} stars"}},
      {"type": "notification", "name": "Alert",
       "config": {"channel": "log", "template": "{input}"}}
    ]}
  }'

curl -X POST http://localhost:8000/api/workflows/1/run
curl "http://localhost:8000/api/runs?workflow_id=1&limit=5"
```

To try a definition without saving it, post the `definition` object on its own to
`/api/runs/ad-hoc` — this is what the builder's **Test run** button does.
