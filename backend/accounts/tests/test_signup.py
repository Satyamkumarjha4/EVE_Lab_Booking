import pytest
from rest_framework.test import APIClient

from accounts.models import User


@pytest.fixture
def client():
    return APIClient()


@pytest.mark.django_db
def test_signup_creates_client_user(client):
    response = client.post(
        "/auth/signup/",
        {"email": "client@example.com", "password": "a-strong-passw0rd"},
    )

    assert response.status_code == 201
    assert "password" not in response.data
    user = User.objects.get(email="client@example.com")
    assert user.role == User.Role.CLIENT


@pytest.mark.django_db
def test_signup_rejects_duplicate_email(client):
    User.objects.create_user(email="client@example.com", password="a-strong-passw0rd")

    response = client.post(
        "/auth/signup/",
        {"email": "client@example.com", "password": "another-strong-pw"},
    )

    assert response.status_code == 400
    assert "email" in response.data


@pytest.mark.django_db
def test_signup_rejects_duplicate_email_differing_only_in_case(client):
    User.objects.create_user(email="client@example.com", password="a-strong-passw0rd")

    response = client.post(
        "/auth/signup/",
        {"email": "Client@Example.com", "password": "another-strong-pw"},
    )

    assert response.status_code == 400
    assert "email" in response.data


@pytest.mark.django_db
def test_signup_stores_email_lowercased(client):
    response = client.post(
        "/auth/signup/",
        {"email": "New.Client@Example.com", "password": "a-strong-passw0rd"},
    )

    assert response.status_code == 201
    assert User.objects.filter(email="new.client@example.com").exists()


@pytest.mark.django_db
def test_signup_rejects_password_similar_to_email(client):
    response = client.post(
        "/auth/signup/",
        {"email": "satyamkumar@example.com", "password": "satyamkumar1"},
    )

    assert response.status_code == 400
    assert "password" in response.data


@pytest.mark.django_db
def test_signup_rejects_weak_password(client):
    response = client.post(
        "/auth/signup/",
        {"email": "client@example.com", "password": "12345678"},
    )

    assert response.status_code == 400
    assert "password" in response.data


@pytest.mark.django_db
def test_signup_rejects_missing_password(client):
    response = client.post("/auth/signup/", {"email": "client@example.com"})

    assert response.status_code == 400
    assert "password" in response.data


@pytest.mark.django_db
def test_signup_ignores_role_field_in_payload(client):
    response = client.post(
        "/auth/signup/",
        {
            "email": "client@example.com",
            "password": "a-strong-passw0rd",
            "role": "PLATFORM_ADMIN",
        },
    )

    assert response.status_code == 201
    user = User.objects.get(email="client@example.com")
    assert user.role == User.Role.CLIENT
