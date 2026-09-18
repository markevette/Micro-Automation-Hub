from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.db import get_session
from app.models.workflow import Workflow, WorkflowRun
from app.schemas.workflow import (
    BlockTypeInfo,
    RunRead,
    WorkflowCreate,
    WorkflowDefinition,
    WorkflowRead,
)
from app.services.blocks import CATALOG, CONFIG_MODELS
from app.services.engine import RunOutcome, execute_workflow

router = APIRouter(prefix="/api", tags=["workflows"])


@router.get("/blocks", response_model=list[BlockTypeInfo])
def list_block_types() -> list[BlockTypeInfo]:
    """Block palette, including each block's config schema for the UI."""
    return [
        BlockTypeInfo(
            type=entry["type"],
            label=entry["label"],
            description=entry["description"],
            config_schema=CONFIG_MODELS[entry["type"]].model_json_schema(),
        )
        for entry in CATALOG
    ]


@router.post("/workflows", response_model=WorkflowRead, status_code=status.HTTP_201_CREATED)
def create_workflow(payload: WorkflowCreate, session: Session = Depends(get_session)) -> Workflow:
    workflow = Workflow(
        name=payload.name,
        description=payload.description,
        definition=payload.definition.model_dump(),
    )
    session.add(workflow)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"a workflow named '{payload.name}' already exists",
        ) from None
    session.refresh(workflow)
    return workflow


@router.get("/workflows", response_model=list[WorkflowRead])
def list_workflows(session: Session = Depends(get_session)) -> list[Workflow]:
    return list(session.scalars(select(Workflow).order_by(Workflow.id)))


@router.get("/workflows/{workflow_id}", response_model=WorkflowRead)
def get_workflow(workflow_id: int, session: Session = Depends(get_session)) -> Workflow:
    return _require_workflow(workflow_id, session)


@router.put("/workflows/{workflow_id}", response_model=WorkflowRead)
def update_workflow(
    workflow_id: int, payload: WorkflowCreate, session: Session = Depends(get_session)
) -> Workflow:
    workflow = _require_workflow(workflow_id, session)
    workflow.name = payload.name
    workflow.description = payload.description
    workflow.definition = payload.definition.model_dump()
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"a workflow named '{payload.name}' already exists",
        ) from None
    session.refresh(workflow)
    return workflow


@router.delete("/workflows/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workflow(workflow_id: int, session: Session = Depends(get_session)) -> None:
    session.delete(_require_workflow(workflow_id, session))
    session.commit()


@router.post("/workflows/{workflow_id}/run", response_model=RunRead)
def run_workflow(workflow_id: int, session: Session = Depends(get_session)) -> WorkflowRun:
    workflow = _require_workflow(workflow_id, session)
    definition = WorkflowDefinition.model_validate(workflow.definition)
    outcome = execute_workflow(definition)
    return _record_run(outcome, session, workflow_id=workflow.id)


@router.post("/runs/ad-hoc", response_model=RunRead)
def run_ad_hoc(definition: WorkflowDefinition, session: Session = Depends(get_session)) -> WorkflowRun:
    """Executes a definition without saving it as a workflow first."""
    outcome = execute_workflow(definition)
    return _record_run(outcome, session, workflow_id=None)


@router.get("/runs", response_model=list[RunRead])
def list_runs(
    session: Session = Depends(get_session),
    workflow_id: int | None = None,
    limit: int = Query(default=20, ge=1, le=100),
) -> list[WorkflowRun]:
    query = select(WorkflowRun).order_by(WorkflowRun.id.desc()).limit(limit)
    if workflow_id is not None:
        query = query.where(WorkflowRun.workflow_id == workflow_id)
    return list(session.scalars(query))


@router.get("/runs/{run_id}", response_model=RunRead)
def get_run(run_id: int, session: Session = Depends(get_session)) -> WorkflowRun:
    run = session.get(WorkflowRun, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="run not found")
    return run


def _require_workflow(workflow_id: int, session: Session) -> Workflow:
    workflow = session.get(Workflow, workflow_id)
    if workflow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="workflow not found")
    return workflow


def _record_run(outcome: RunOutcome, session: Session, workflow_id: int | None) -> WorkflowRun:
    run = WorkflowRun(
        workflow_id=workflow_id,
        status=outcome.status,
        started_at=outcome.started_at,
        duration_ms=outcome.duration_ms,
        error=outcome.error,
        steps=[step.model_dump() for step in outcome.steps],
    )
    session.add(run)
    session.commit()
    session.refresh(run)
    return run
