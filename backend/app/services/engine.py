"""Sequential workflow execution engine.

Blocks run in order, each receiving the previous block's output. A run stops at
the first block that fails or filters it out; every block that did run is
recorded with its own status, timing, and logs.
"""

import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from app.schemas.workflow import StepResult, WorkflowDefinition
from app.services.blocks import HANDLERS, BlockError, FilteredOut

logger = logging.getLogger(__name__)

# Run history is stored as JSON, so oversized block outputs are summarised
# rather than persisted in full.
MAX_STORED_OUTPUT_CHARS = 2000


@dataclass
class RunOutcome:
    status: str
    started_at: datetime
    duration_ms: int
    steps: list[StepResult] = field(default_factory=list)
    error: str | None = None
    output: Any = None


def _storable(value: Any) -> Any:
    """Keeps persisted step output small and JSON-serialisable."""
    try:
        encoded = json.dumps(value)
    except (TypeError, ValueError):
        return {"_unserialisable": str(type(value).__name__), "preview": str(value)[:500]}

    if len(encoded) <= MAX_STORED_OUTPUT_CHARS:
        return value
    return {
        "_truncated": True,
        "size_chars": len(encoded),
        "preview": encoded[:500],
    }


def execute_workflow(definition: WorkflowDefinition) -> RunOutcome:
    started_at = datetime.now(timezone.utc)
    run_started = time.perf_counter()
    steps: list[StepResult] = []
    value: Any = None

    for block in definition.blocks:
        handler = HANDLERS[block.type]
        logs: list[str] = []
        step_started = time.perf_counter()

        try:
            value = handler(block.config, value, logs)
        except FilteredOut as exc:
            steps.append(
                StepResult(
                    name=block.name,
                    type=block.type,
                    status="filtered",
                    duration_ms=_elapsed_ms(step_started),
                    logs=logs,
                    error=str(exc),
                )
            )
            logger.info("workflow filtered out at block '%s': %s", block.name, exc)
            return RunOutcome(
                status="filtered",
                started_at=started_at,
                duration_ms=_elapsed_ms(run_started),
                steps=steps,
                error=str(exc),
            )
        except BlockError as exc:
            steps.append(
                StepResult(
                    name=block.name,
                    type=block.type,
                    status="failed",
                    duration_ms=_elapsed_ms(step_started),
                    logs=logs,
                    error=str(exc),
                )
            )
            logger.warning("workflow failed at block '%s': %s", block.name, exc)
            return RunOutcome(
                status="failed",
                started_at=started_at,
                duration_ms=_elapsed_ms(run_started),
                steps=steps,
                error=f"{block.name}: {exc}",
            )
        except Exception as exc:  # noqa: BLE001 - a block bug must not kill the API
            logger.exception("unexpected error in block '%s'", block.name)
            steps.append(
                StepResult(
                    name=block.name,
                    type=block.type,
                    status="failed",
                    duration_ms=_elapsed_ms(step_started),
                    logs=logs,
                    error=f"unexpected error: {exc}",
                )
            )
            return RunOutcome(
                status="failed",
                started_at=started_at,
                duration_ms=_elapsed_ms(run_started),
                steps=steps,
                error=f"{block.name}: unexpected error: {exc}",
            )

        steps.append(
            StepResult(
                name=block.name,
                type=block.type,
                status="success",
                output=_storable(value),
                duration_ms=_elapsed_ms(step_started),
                logs=logs,
            )
        )

    return RunOutcome(
        status="success",
        started_at=started_at,
        duration_ms=_elapsed_ms(run_started),
        steps=steps,
        output=value,
    )


def _elapsed_ms(since: float) -> int:
    return int((time.perf_counter() - since) * 1000)
