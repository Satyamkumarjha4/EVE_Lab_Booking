from datetime import timedelta

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import User


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def refresh_token(client):
    User.objects.create_user(email="client@example.com", password="a-strong-passw0rd")
    response = client.post(
        "/auth/login/",
        {"email": "client@example.com", "password": "a-strong-passw0rd"},
    )
    return response.data["refresh"]


@pytest.mark.django_db
def test_refresh_returns_new_access_token(client, refresh_token):
    response = client.post("/auth/refresh/", {"refresh": refresh_token})

    assert response.status_code == 200
    assert "access" in response.data


@pytest.mark.django_db
def test_refresh_rejects_invalid_token(client):
    response = client.post("/auth/refresh/", {"refresh": "not-a-real-token"})

    assert response.status_code == 401


@pytest.mark.django_db
def test_refresh_rejects_expired_token(client):
    user = User.objects.create_user(email="client@example.com", password="a-strong-passw0rd")
    token = RefreshToken.for_user(user)
    token.set_exp(lifetime=timedelta(seconds=-1))

    response = client.post("/auth/refresh/", {"refresh": str(token)})

    assert response.status_code == 401
