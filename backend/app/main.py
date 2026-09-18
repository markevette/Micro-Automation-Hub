import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api.workflows import router as workflows_router
from app.core.config import settings
from app.core.db import Base, SessionLocal, engine

# Imported for its side effect of registering the tables on Base.metadata.
from app.models import workflow as _workflow_models  # noqa: F401
from app.services.examples import seed_examples

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # There is no migration tool yet, so the schema is created on startup. A
    # database that is not reachable must not stop the API from serving
    # /health, so failures here are logged rather than raised.
    try:
        Base.metadata.create_all(bind=engine)
        with SessionLocal() as session:
            seed_examples(session)
    except SQLAlchemyError:
        logger.warning("database unavailable at startup; schema and seed skipped", exc_info=True)
    yield


app = FastAPI(title="Micro Automation Hub", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(workflows_router)


@app.get("/health")
def health_check():
    """Liveness check: the process is up. Does not touch the database."""
    return {"status": "ok"}


@app.get("/health/db")
def database_health_check():
    """Readiness check: confirms the database is actually reachable."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="database unavailable") from exc
    return {"status": "ok"}
