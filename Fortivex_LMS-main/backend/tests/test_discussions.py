from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from app.api.v1.endpoints.discussions import _format_time_ago, _get_author_role
from app.models.user import User


def test_list_discussions_requires_auth(client: TestClient) -> None:
    response = client.get("/api/v1/discussions")
    assert response.status_code == 401


def test_create_discussion_requires_auth(client: TestClient) -> None:
    response = client.post(
        "/api/v1/discussions",
        json={"title": "Test Title", "content": "Test Content with enough length"},
    )
    assert response.status_code == 401


def test_get_discussion_requires_auth(client: TestClient) -> None:
    response = client.get("/api/v1/discussions/1")
    assert response.status_code == 401


def test_add_reply_requires_auth(client: TestClient) -> None:
    response = client.post("/api/v1/discussions/1/replies", json={"content": "Here is an answer"})
    assert response.status_code == 401


def test_upvote_discussion_requires_auth(client: TestClient) -> None:
    response = client.post("/api/v1/discussions/1/upvote")
    assert response.status_code == 401


def test_delete_discussion_requires_auth(client: TestClient) -> None:
    response = client.delete("/api/v1/discussions/1")
    assert response.status_code == 401


def test_delete_reply_requires_auth(client: TestClient) -> None:
    response = client.delete("/api/v1/discussions/replies/1")
    assert response.status_code == 401


def test_format_time_ago_helper() -> None:
    now = datetime.now(timezone.utc)
    assert _format_time_ago(now) == "Just now"
    assert _format_time_ago(now - timedelta(minutes=5)) == "5m ago"
    assert _format_time_ago(now - timedelta(hours=3)) == "3h ago"
    assert _format_time_ago(now - timedelta(days=2)) == "2d ago"
    assert _format_time_ago(None) == ""

