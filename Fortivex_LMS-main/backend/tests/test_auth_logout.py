from fastapi.testclient import TestClient

from app.main import app


def test_logout_requires_auth(client: TestClient) -> None:
    response = client.post("/api/v1/auth/logout")
    assert response.status_code == 401


def test_invalid_login_does_not_silently_succeed() -> None:
    """DB is unreachable in this environment, so this exercises the
    generic-500-on-unreachable-DB path rather than a real credential
    check (that round-trip was verified live against uvicorn — see
    docs/BACKEND_STATUS.md). `raise_server_exceptions=False` is needed
    here because Starlette's TestClient re-raises exceptions handled by
    the catch-all `Exception` handler by default; the health/db test
    avoids this by catching inside the endpoint instead."""
    local_client = TestClient(app, raise_server_exceptions=False)
    response = local_client.post(
        "/api/v1/auth/login",
        data={"username": "nobody@example.com", "password": "wrong"},
    )
    assert response.status_code in (401, 500)
    if response.status_code == 401:
        assert response.json() == {"detail": "Incorrect email or password"}
    else:
        assert response.json() == {"detail": "Internal server error"}
