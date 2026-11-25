from fastapi.testclient import TestClient
from app.core.security import create_password_reset_token, verify_password_reset_token


def test_password_reset_token_generation_and_verification() -> None:
    token = create_password_reset_token("student@empowers.com", expires_minutes=15)
    assert token is not None
    assert isinstance(token, str)

    email = verify_password_reset_token(token)
    assert email == "student@empowers.com"


def test_invalid_password_reset_token() -> None:
    assert verify_password_reset_token("invalid.token.here") is None
    assert verify_password_reset_token("") is None


def test_forgot_password_requires_non_empty_email(client: TestClient) -> None:
    response = client.post("/api/v1/auth/forgot-password", json={"email": ""})
    assert response.status_code == 400


def test_reset_password_with_invalid_token(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/reset-password",
        json={"token": "invalid_token_123", "new_password": "validPassword123"},
    )
    assert response.status_code == 400


def test_reset_password_with_short_password(client: TestClient) -> None:
    token = create_password_reset_token("student@empowers.com")
    response = client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "123"},
    )
    assert response.status_code == 400


def test_reset_password_with_profile_payload_validation(client: TestClient) -> None:
    token = create_password_reset_token("student@empowers.com")
    response = client.post(
        "/api/v1/auth/reset-password",
        json={
            "token": token,
            "new_password": "123",
            "full_name": "Test Student",
            "phone_number": "1234567890",
            "title": "Software Fellow",
        },
    )
    assert response.status_code == 400


