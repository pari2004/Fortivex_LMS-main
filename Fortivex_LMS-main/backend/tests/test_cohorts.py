from fastapi.testclient import TestClient


def test_list_cohorts_requires_auth(client: TestClient) -> None:
    response = client.get("/api/v1/cohorts")
    assert response.status_code == 401


def test_get_cohort_requires_auth(client: TestClient) -> None:
    response = client.get("/api/v1/cohorts/1")
    assert response.status_code == 401


def test_create_cohort_requires_auth(client: TestClient) -> None:
    response = client.post(
        "/api/v1/cohorts",
        json={
            "program_id": 1,
            "organization_id": 1,
            "name": "Test Cohort",
            "code": "TEST-COHORT",
            "start_date": "2026-01-01",
        },
    )
    assert response.status_code == 401


def test_update_cohort_requires_auth(client: TestClient) -> None:
    response = client.patch("/api/v1/cohorts/1", json={"name": "Renamed"})
    assert response.status_code == 401


def test_sync_cohort_status_logic() -> None:
    from datetime import date, timedelta
    from app.models.cohort import Cohort
    from app.models.enums import CohortStatus
    from app.api.v1.endpoints.cohorts import _sync_cohort_status

    today = date(2026, 11, 11)
    # 1. Past start date should transition from UPCOMING to ACTIVE
    c1 = Cohort(name="Past Cohort", code="P1", start_date=today - timedelta(days=10), status=CohortStatus.UPCOMING)
    assert _sync_cohort_status(c1, today) is True
    assert c1.status == CohortStatus.ACTIVE

    # 2. Future start date stays UPCOMING
    c2 = Cohort(name="Future Cohort", code="F1", start_date=today + timedelta(days=5), status=CohortStatus.UPCOMING)
    assert _sync_cohort_status(c2, today) is False
    assert c2.status == CohortStatus.UPCOMING

    # 3. Past end date should transition to COMPLETED
    c3 = Cohort(name="Old Cohort", code="O1", start_date=today - timedelta(days=60), end_date=today - timedelta(days=5), status=CohortStatus.ACTIVE)
    assert _sync_cohort_status(c3, today) is True
    assert c3.status == CohortStatus.COMPLETED

    # 4. CANCELLED cohort never auto-transitions
    c4 = Cohort(name="Cancelled Cohort", code="C1", start_date=today - timedelta(days=10), status=CohortStatus.CANCELLED)
    assert _sync_cohort_status(c4, today) is False
    assert c4.status == CohortStatus.CANCELLED

