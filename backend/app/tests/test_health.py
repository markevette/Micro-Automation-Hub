from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_check_reports_ok():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_database_health_check_reports_503_when_database_is_unreachable(monkeypatch):
    """The readiness endpoint must degrade to 503 rather than raising a 500."""
    from sqlalchemy.exc import OperationalError

    from app.main import engine

    def fail_to_connect():
        raise OperationalError("SELECT 1", {}, Exception("connection refused"))

    monkeypatch.setattr(engine, "connect", fail_to_connect)

    response = client.get("/health/db")

    assert response.status_code == 503
