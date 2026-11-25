from datetime import datetime
from fastapi.testclient import TestClient
from app.api.v1.endpoints.students import _parse_iso_datetime


def test_nav_counts_requires_auth(client: TestClient) -> None:
    response = client.get("/api/v1/students/me/nav-counts")
    assert response.status_code == 401


def test_live_status_requires_auth(client: TestClient) -> None:
    response = client.get("/api/v1/curriculum/live-status")
    assert response.status_code == 401


def test_parse_iso_datetime_helper() -> None:
    assert _parse_iso_datetime(None) is None
    assert _parse_iso_datetime("") is None
    assert _parse_iso_datetime("invalid-date") is None

    dt1 = _parse_iso_datetime("2026-11-13T14:30:00")
    assert dt1 is not None
    assert dt1.year == 2026 and dt1.month == 11 and dt1.day == 13 and dt1.hour == 14 and dt1.minute == 30

    dt2 = _parse_iso_datetime("2026-11-13 10:15")
    assert dt2 is not None
    assert dt2.hour == 10 and dt2.minute == 15

    dt3 = _parse_iso_datetime("2026-11-13T10:15:00Z")
    assert dt3 is not None
    assert dt3.year == 2026

