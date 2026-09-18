# Frontend – Micro Automation Hub

React + TypeScript client for the Micro Automation Hub. Bootstrapped with Create
React App and served in production by nginx from a two-stage Docker build.

For the full stack, see the [project README](../README.md) and the
[installation instructions](../docs/installation-run-instructions.md).

## Scripts

```bash
npm install                   # install dependencies
npm start                     # dev server on http://localhost:3000
npm test -- --watchAll=false  # run the suite once (15 tests)
npm run build                 # production bundle into build/
```

The test suite needs no running backend: `fetch` is stubbed per test, so the API
client is exercised against controlled responses.

## Configuration

One variable, `REACT_APP_API_URL`, defaulting to `http://localhost:8000`.

**It is inlined into the bundle at build time.** Create React App substitutes
`process.env.REACT_APP_*` during `npm run build`, so in Docker it is passed as a
build argument and changing it requires `docker compose up --build` rather than a
restart. Because the browser calls the API directly at this URL, the backend's
`BACKEND_CORS_ORIGINS` must also include the origin the frontend is served from.

## Structure

```
src/
├── api.ts                        Backend client and shared TypeScript types
├── blocks.ts                     Block metadata, defaults, value coercion
├── App.tsx                       Workflow list, run result, run history
├── App.css                       All styling
└── components/
    ├── WorkflowBuilder.tsx       Palette, block list, reorder, test run, save
    ├── BlockConfigEditor.tsx     Per-block-type configuration controls
    ├── KeyValueEditor.tsx        Reusable string-map editor
    └── RunResult.tsx             Per-block timeline with status, logs, output
```

`api.ts` is the only module that talks to the backend. It owns the interfaces
shared with the API and flattens FastAPI's 422 validation arrays into
single-line messages, since the raw structure is not useful in an interface.

`blocks.ts` holds the frontend's knowledge of the block library: labels,
default configurations for newly added blocks, and the coercion that turns
text-field input into the JSON type the API expects — which is what makes a
filter compare `1000` numerically rather than as `"1000"`.

## Notes for Contributors

**Adding a block type currently requires a frontend change.** `GET /api/blocks`
publishes a JSON Schema for each block's configuration and drives the palette,
but the configuration forms in `BlockConfigEditor.tsx` are written by hand per
type. This duplication is deliberate — it buys controls that fit the data — and
is recorded as item 8 of the
[technical debt register](../docs/technical-debt.md).

**Tests query by accessible role and label**, not by class name or test id, so
they assert on what a user can perceive. Keep labels on new controls; several
tests depend on them, and so do screen readers.

**Block reordering uses buttons rather than dragging**, which keeps it keyboard
operable without a drag-and-drop dependency. See
[AD-14](../docs/architecture/decisions.md#ad-14-reordering-by-buttons-rather-than-dragging).
