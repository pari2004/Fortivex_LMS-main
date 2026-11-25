from fastapi.testclient import TestClient

from app.db.session import get_db
from app.main import app


def test_root_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_versioned_health(client: TestClient) -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_db_health_reports_generic_failure_when_unreachable(client: TestClient, monkeypatch) -> None:
    class UnavailableDatabase:
        def execute(self, statement) -> None:
            raise RuntimeError("connection failed with sensitive database details")

    def get_unavailable_db():
        yield UnavailableDatabase()

    monkeypatch.setitem(app.dependency_overrides, get_db, get_unavailable_db)
    response = client.get("/api/v1/health/db")
    assert response.status_code == 503
    assert response.json() == {"status": "error", "detail": "Database unavailable"}
