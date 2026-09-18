# Lessons Learned – Micro Automation Hub

Reflection on the development of the Micro Automation Hub. The lessons below are
drawn from problems actually encountered, and each records what changed as a
result.

## 1. Vertical Slices Surface Integration Problems Early

Building each increment as a thin path through every layer — database, API, and
interface — rather than completing one layer at a time meant the stack was
executable from the first increment onward.

That is how the genuinely expensive problems were found. Startup ordering against
PostgreSQL, the difference between build-time and runtime configuration in the
frontend, and a lockfile that had drifted out of sync with its manifest were all
integration failures: every unit test passed while the assembled system did not
work. Had the layers been built separately, all three would have surfaced at the
end, together, at the point of least available time.

## 2. "Working" and "Correct" Are Not the Same Question

The most valuable single design decision was separating a run that *filtered
itself out* from a run that *failed*. A workflow whose filter correctly decided
there was nothing to do has behaved exactly as designed; reporting it as a
failure would be actively harmful, because it trains the user to ignore
failures.

This distinction is not a UI nicety — it propagates through the engine's
exception types, the persisted run status, the API response, and the interface.
It had to be decided before the engine was written, because retrofitting a third
outcome state into a boolean success/failure model would have meant touching
every one of those layers.

## 3. Error Messages Are a Feature, Not an Afterthought

Early failure messages said what went wrong but not what to do about it — a bare
`KeyError` for a template placeholder, for instance. Since the user of this
system composes workflows through a form rather than by debugging code, these
strings are the entire diagnostic surface.

Messages were rewritten to name the offending element and, where possible, the
valid alternatives: an unknown template placeholder now lists the names that
*were* available, and a failing path names the exact segment at fault.
Retrospectively, the error messages deserved the same design attention as the
interface, and got it later than they should have.

## 4. Defensive Design Against Untrusted Endpoints

Workflows call endpoints the system does not control, so every failure mode of a
third-party HTTP call is a failure mode of the product. Three mechanisms were
needed before execution felt stable: mandatory timeouts with a validated upper
bound, so a hanging endpoint cannot stall a run indefinitely; conversion of
error statuses and transport exceptions into block failures rather than
unhandled exceptions; and a catch-all in the engine so that a defect in one
block degrades that run rather than the API process.

Two decisions were also made *not* to handle: retries were deliberately omitted
because a blind retry of a non-idempotent request would be worse than failing,
and a non-JSON response is passed on as text rather than treated as an error.

## 5. Testability Has to Be Designed In

Two seams were introduced specifically so that tests need neither network nor
database: the HTTP transport is reached through a module-level indirection, and
the database session is a FastAPI dependency. A third choice — the portable
`JSON` column type rather than PostgreSQL's `JSONB` — was what made the
in-memory SQLite substitution possible at all.

None of these were free, and all three were cheaper to introduce up front than
to retrofit. The payoff is a suite of 27 backend and 15 frontend tests that runs
in seconds with no external dependencies, which is what made it practical to run
them on every change.

## 6. Build-Time Configuration Is a Trap

Create React App inlines environment variables into the bundle at build time, so
`REACT_APP_API_URL` cannot be changed by restarting the container. Combined with
the decision to have the browser call the API directly rather than through an
nginx proxy, this produces a failure that is genuinely hard to diagnose: the
application shows no data, and the backend logs show nothing wrong, because the
request never arrived.

The mitigation was documentation — the constraint is now stated explicitly in the
deployment view and the installation instructions. The better fix, noted for
future work, is to proxy API calls through nginx so that the frontend has a
single origin and no baked-in backend URL.

## 7. Container Images Reward a Second Look

The frontend image was initially about 3 GB, because it ran the development
server and therefore shipped Node.js and the full `node_modules` tree. A
two-stage build that compiles the bundle and copies only the output into an
nginx image brought it to roughly 75 MB — a fortyfold reduction from a change of
a few lines.

The related lesson concerns build context. `.dockerignore` files matter for more
than speed: without them, a `COPY . .` can overwrite the container's freshly
installed dependencies with the host's platform-specific ones, which produces
build failures that look unrelated to their cause.

## 8. Repository Hygiene Is Not Cosmetic

The project occupied roughly 481 MB on disk, of which about 480 MB was duplicated
`node_modules` trees — including an entire second copy of the frontend under
`infrastructure/`. After removing the duplication and hardening the ignore files,
the tracked project is under 1 MB.

The underlying lesson is that ignore rules need to be correct *before* the
directories they describe exist. Duplication of this kind accumulates silently
and is far easier to prevent than to unpick later, since by then it is unclear
which copy is authoritative.

## 9. Modular Boundaries Pay Off When They Are Directional

Separating the backend by responsibility helped, but the specific benefit came
from one boundary being strictly one-directional: the execution engine never
touches the database. It accepts a validated definition and returns an outcome;
persisting that outcome is the router's job.

That single constraint is what makes the engine a pure function of its input,
and therefore what makes all three outcome paths exhaustively testable without a
database. Modularity by itself would not have achieved this — a `services` layer
that also wrote its own run records would have been just as "modular" and far
harder to test.

## 10. Validating at the Boundary Simplifies Everything Behind It

Modelling blocks as a discriminated union keyed on `type`, with each
configuration rejecting unknown keys, means an invalid definition is refused at
the HTTP boundary with a precise message before any execution begins. The engine
can then assume well-formed input and does not re-validate.

A useful side effect, unanticipated when the decision was made: the
configuration schemas became machine-readable for free, which is what
`GET /api/blocks` publishes to drive the builder's palette.

## 11. Documentation Drifts Unless It Is Treated as Part of the Change

The single most persistent problem in this project was documentation describing
features that did not exist — an authentication module, a workflow builder, and
database behaviour that had never been implemented. Documentation that overstates
the system is worse than none, because it removes the reader's ability to trust
any of it.

Two practices addressed this. First, documentation is revised in the same
increment as the code it describes: when the builder was added, the technical
debt entry describing authoring as API-only was not deleted but *rewritten* to
describe what remained missing. Second, requirements carry an explicit
implementation status and are traced to the tests that verify them, so a claim
of completion is checkable rather than asserted.

## 12. What Was Not Done, and Why It Matters

Two gaps deserve naming rather than burying.

**Security.** The API is entirely unauthenticated, and the HTTP request block
will call any URL it is given from inside the container network. Together these
make the system unsuitable for public deployment — it could be used as an
anonymising request proxy. Recording this as "partially met" would have
misrepresented it; it is recorded as not met.

**Usability evidence.** The interface was built with usability in mind —
plain-language block descriptions, controls appropriate to each data type,
inline hints for paths and templates, test runs before saving, and reordering by
buttons so the interaction stays keyboard operable. But **no usability testing
with real users was conducted.** The design rests on reasoning, not evidence,
and the honest conclusion is that some of it is probably wrong in ways only
observation would reveal. Deciding what to prioritise for a non-technical
audience is exactly the kind of question that intuition answers badly.

## Summary

The techniques that repaid their cost most clearly were building end-to-end from
the first increment, designing the seams that make testing possible before
writing the code behind them, and recording limitations honestly as they arose.
The clearest remaining shortfalls are the absence of authentication and the
absence of real usability evidence, both tracked in the
[technical debt register](technical-debt.md).
