from fastapi.testclient import TestClient


def test_list_enrollments_requires_auth(client: TestClient) -> None:
    response = client.get("/api/v1/enrollments")
    assert response.status_code == 401


def test_create_enrollment_requires_auth(client: TestClient) -> None:
    response = client.post(
        "/api/v1/enrollments",
        json={"student_id": 1, "program_id": 1, "organization_id": 1},
    )
    assert response.status_code == 401


def test_create_enrollment_validates_body_when_unauthenticated_is_checked_first(client: TestClient) -> None:
    """Auth is checked before body validation for this endpoint (FastAPI
    resolves the require_roles dependency before parsing the request body),
    so a bad payload with no token still reports 401, not 422."""
    response = client.post("/api/v1/enrollments", json={})
    assert response.status_code == 401
