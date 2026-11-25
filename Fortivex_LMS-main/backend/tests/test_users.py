from fastapi.testclient import TestClient


def test_list_users_requires_auth(client: TestClient) -> None:
    response = client.get("/api/v1/users")
    assert response.status_code == 401


def test_create_user_requires_auth(client: TestClient) -> None:
    response = client.post(
        "/api/v1/users",
        json={
            "email": "new-user@example.com",
            "full_name": "New User",
            "password": "password123",
            "organization_id": 1,
        },
    )
    assert response.status_code == 401


def test_bulk_create_users_requires_auth(client: TestClient) -> None:
    response = client.post(
        "/api/v1/users/bulk",
        json={
            "organization_id": 1,
            "users": [
                {
                    "email": "bulk1@example.com",
                    "full_name": "Bulk User 1",
                }
            ],
        },
    )
    assert response.status_code == 401


def test_delete_user_requires_auth(client: TestClient) -> None:
    response = client.delete("/api/v1/users/999")
    assert response.status_code == 401


def test_admin_reset_user_password_requires_auth(client: TestClient) -> None:
    response = client.post(
        "/api/v1/users/999/reset-password",
        json={"new_password": "NewSecretPassword123", "must_change_password": True},
    )
    assert response.status_code == 401

