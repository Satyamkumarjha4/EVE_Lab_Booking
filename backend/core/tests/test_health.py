import pytest
from rest_framework.test import APIClient


@pytest.fixture
def client():
    return APIClient()


@pytest.mark.django_db
def test_health_check_returns_ok(client):
    response = client.get("/api/health/")

    assert response.status_code == 200
    assert response.data["status"] == "ok"
    assert response.data["checks"] == {"database": True, "redis": True}


@pytest.mark.django_db
def test_health_check_does_not_require_authentication(client):
    response = client.get("/api/health/")

    assert response.status_code != 401
    assert response.status_code != 403
