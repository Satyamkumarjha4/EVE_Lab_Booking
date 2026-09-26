import pytest
from rest_framework.test import APIClient

from accounts.models import User


@pytest.fixture
def client():
    return APIClient()


@pytest.mark.django_db
def test_login_is_rate_limited_after_five_attempts_per_minute(client):
    User.objects.create_user(email="client@example.com", password="a-strong-passw0rd")

    for _ in range(5):
        response = client.post(
            "/auth/login/",
            {"email": "client@example.com", "password": "wrong-password"},
        )
        assert response.status_code == 401

    throttled = client.post(
        "/auth/login/",
        {"email": "client@example.com", "password": "wrong-password"},
    )

    assert throttled.status_code == 429


@pytest.mark.django_db
def test_spoofed_forwarded_for_header_does_not_bypass_login_throttle(client):
    for attempt in range(5):
        client.post(
            "/auth/login/",
            {"email": "nobody@example.com", "password": "wrong-password"},
            HTTP_X_FORWARDED_FOR=f"10.0.0.{attempt}",
        )

    throttled = client.post(
        "/auth/login/",
        {"email": "nobody@example.com", "password": "wrong-password"},
        HTTP_X_FORWARDED_FOR="10.0.0.99",
    )

    assert throttled.status_code == 429
