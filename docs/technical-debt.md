Technical Debt – Micro Automation Hub

This document records the technical debt accumulated during the development of the Micro Automation Hub. These items represent limitations, postponed features, or architectural compromises that could not be addressed within the scope of the project. Each entry includes a short description and the recommended future improvement.

1. Workflow Scheduling
Description:  
The system currently supports only manual workflow execution. Users cannot schedule workflows to run automatically at fixed intervals or based on triggers.

Future Improvement:  
Introduce a scheduling subsystem (e.g., APScheduler or Celery Beat) to support recurring and event‑driven executions.

2. Limited Block Diversity
Description:  
Only the MVP block set is implemented: HTTP Request, Extract Fields, Filter, Text Transform, and Notification. There is no way to authenticate against a protected endpoint beyond hand-written headers, no block that persists data, and no block that parses a non-JSON payload.

Future Improvement:  
Extend the block library with parsing blocks, authentication blocks, and data‑storage blocks.

3. Error Diagnostics Stop at the Block Boundary
Description:  
Failures are reported as structured per-step records — status, message, logs, and timing — and rendered as a colour-coded timeline, so the failing block and its reason are visible. What is missing is the link back to the cause: the builder does not highlight the configuration field responsible for a failure, and a run cannot be re-opened in the builder for correction.

Future Improvement:  
Attach the offending config path to block errors, highlight that field in the builder, and allow a failed run to be loaded back into the builder for editing and re‑running.

4. No Role‑Based Access Control
Description:  
All users share identical permissions; administrative or multi‑role functionality is not implemented.

Future Improvement:  
Introduce RBAC with differentiated privileges for administrators, editors, and standard users.

5. Single Example Workflow, No Template Library
Description:  
One example workflow ("GitHub repo watcher") is seeded on first startup. It exercises every block type, but there is no library a user can start a new workflow from — the builder always begins with an empty block list.

Future Improvement:  
Add a set of starting templates covering common automation patterns, selectable when creating a workflow, and allow an existing workflow to be duplicated as a starting point.

6. No Database Migrations
Description:  
The schema is created with `Base.metadata.create_all()` when the API starts. This is sufficient for a fresh database but cannot evolve an existing one, so any change to a model requires dropping the volume.

Future Improvement:  
Introduce Alembic and generate versioned migrations, then remove the create‑on‑startup call.

7. Notification Channels Limited to Logging
Description:  
The notification block only writes to the application log. The email settings in `env.example` are read but unused.

Future Improvement:  
Implement an SMTP channel behind the existing `channel` field, with retries and delivery status recorded on the run.

8. Builder Has No Drag-and-Drop or Draft Persistence
Description:  
The visual builder composes workflows from a block palette, but blocks are reordered with up/down controls rather than by dragging, and an unsaved draft is lost on page reload. The per-block configuration forms are also hand-written per block type rather than generated from the `config_schema` that `/api/blocks` already publishes, so adding a block type means touching the frontend as well as the backend.

Future Improvement:  
Add pointer- and keyboard-accessible drag-and-drop, persist drafts locally, and drive the configuration forms from the published schema so new block types need no frontend change.

9. No Branching or Parallelism in the Engine
Description:  
Execution is strictly sequential and single‑valued: each block receives only the previous block's output. Conditional branches, loops, and fan‑out are not expressible.

Future Improvement:  
Move from a block list to a directed graph with a named context, so blocks can reference the output of any earlier block.

10. Unauthenticated API
Description:  
Every endpoint is public, and the HTTP request block will call any URL it is given. Running this outside a trusted network would expose it to abuse as a request proxy.

Future Improvement:  
Add authentication before any public deployment, and restrict outbound request targets with an allow‑list.