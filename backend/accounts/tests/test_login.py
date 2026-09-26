import pytest
from rest_framework.test import APIClient

from accounts.models import User


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def user():
    return User.objects.create_user(email="client@example.com", password="a-strong-passw0rd")


@pytest.mark.django_db
def test_login_returns_token_pair_for_valid_credentials(client, user):
    response = client.post(
        "/auth/login/",
        {"email": "client@example.com", "password": "a-strong-passw0rd"},
    )

    assert response.status_code == 200
    assert "access" in response.data
    assert "refresh" in response.data


@pytest.mark.django_db
def test_login_rejects_bad_password(client, user):
    response = client.post(
        "/auth/login/",
        {"email": "client@example.com", "password": "wrong-password"},
    )

    assert response.status_code == 401


@pytest.mark.django_db
def test_login_rejects_unknown_email(client):
    response = client.post(
        "/auth/login/",
        {"email": "nobody@example.com", "password": "a-strong-passw0rd"},
    )

    assert response.status_code == 401


@pytest.mark.django_db
def test_login_rejects_inactive_user(client, user):
    user.is_active = False
    user.save()

    response = client.post(
        "/auth/login/",
        {"email": "client@example.com", "password": "a-strong-passw0rd"},
    )

    assert response.status_code == 401
