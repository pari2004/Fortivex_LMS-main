from fastapi.testclient import TestClient


def test_list_organizations_requires_auth(client: TestClient) -> None:
    response = client.get("/api/v1/organizations")
    assert response.status_code == 401


def test_get_organization_requires_auth(client: TestClient) -> None:
    response = client.get("/api/v1/organizations/1")
    assert response.status_code == 401


def test_update_organization_requires_auth(client: TestClient) -> None:
    response = client.patch("/api/v1/organizations/1", json={"name": "New Name"})
    assert response.status_code == 401

