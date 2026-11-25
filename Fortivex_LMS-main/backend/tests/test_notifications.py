from fastapi.testclient import TestClient


def test_list_notifications_requires_auth(client: TestClient) -> None:
    response = client.get("/api/v1/notifications")
    assert response.status_code == 401


def test_mark_notification_read_requires_auth(client: TestClient) -> None:
    response = client.patch("/api/v1/notifications/1/read")
    assert response.status_code == 401


def test_mark_all_notifications_read_requires_auth(client: TestClient) -> None:
    response = client.post("/api/v1/notifications/mark-all-read")
    assert response.status_code == 401


def test_delete_notification_requires_auth(client: TestClient) -> None:
    response = client.delete("/api/v1/notifications/1")
    assert response.status_code == 401
