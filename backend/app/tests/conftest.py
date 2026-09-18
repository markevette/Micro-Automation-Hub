from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.db import Base, get_session
from app.main import app

# Registers the tables on Base.metadata before create_all runs.
from app.models import workflow as _workflow_models  # noqa: F401
from app.services import blocks


class FakeResponse:
    """Minimal stand-in for requests.Response."""

    def __init__(self, payload: Any = None, status_code: int = 200, text: str = ""):
        self._payload = payload
        self.status_code = status_code
        self.text = text

    def json(self) -> Any:
        if self._payload is None:
            raise ValueError("no JSON body")
        return self._payload


@pytest.fixture
def client():
    """TestClient backed by an isolated in-memory SQLite database.

    Deliberately constructed without a context manager so the app's lifespan
    (which targets Postgres) does not run.
    """
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override_get_session():
        session = TestingSession()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_session] = override_get_session
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def stub_http(monkeypatch):
    """Replaces the HTTP transport so tests never touch the network."""

    def _install(payload: Any = None, status_code: int = 200, text: str = "", error: Exception | None = None):
        calls: list[Any] = []

        def transport(config):
            calls.append(config)
            if error is not None:
                raise error
            return FakeResponse(payload=payload, status_code=status_code, text=text)

        monkeypatch.setattr(blocks, "http_transport", transport)
        return calls

    return _install
