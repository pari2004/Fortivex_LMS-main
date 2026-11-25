from fastapi.testclient import TestClient


def test_list_programs_requires_auth(client: TestClient) -> None:
    response = client.get("/api/v1/programs")
    assert response.status_code == 401


def test_get_program_requires_auth(client: TestClient) -> None:
    response = client.get("/api/v1/programs/1")
    assert response.status_code == 401


def test_create_program_requires_auth(client: TestClient) -> None:
    response = client.post(
        "/api/v1/programs", json={"organization_id": 1, "name": "Test Program", "code": "TEST"}
    )
    assert response.status_code == 401


def test_update_program_requires_auth(client: TestClient) -> None:
    response = client.patch("/api/v1/programs/1", json={"name": "Renamed"})
    assert response.status_code == 401


def test_list_all_program_documents_requires_auth(client: TestClient) -> None:
    response = client.get("/api/v1/programs/documents/all")
    assert response.status_code == 401


def test_delete_program_document_requires_auth(client: TestClient) -> None:
    response = client.delete("/api/v1/programs/documents/1")
    assert response.status_code == 401
