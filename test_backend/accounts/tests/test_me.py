import pytest
from rest_framework.test import APIClient

from accounts.models import User
from catalog.models import Centre, Lab


@pytest.fixture
def client():
    return APIClient()


@pytest.mark.django_db
def test_me_returns_current_client_user(client):
    user = User.objects.create_user(email="client@example.com", password="a-strong-passw0rd")
    client.force_authenticate(user=user)

    response = client.get("/auth/me/")

    assert response.status_code == 200
    assert response.data == {
        "id": user.id,
        "email": "client@example.com",
        "role": "CLIENT",
        "lab": None,
        "centre": None,
    }


@pytest.mark.django_db
def test_me_returns_lab_and_centre_for_lab_role(client):
    lab = Lab.objects.create(name="Apollo Diagnostics", location="Delhi")
    user = User.objects.create_user(
        email="lab@example.com", password="a-strong-passw0rd", role=User.Role.LAB, lab=lab
    )
    client.force_authenticate(user=user)

    response = client.get("/auth/me/")

    assert response.status_code == 200
    assert response.data["role"] == "LAB"
    assert response.data["lab"] == lab.id
    assert response.data["centre"] is None


@pytest.mark.django_db
def test_me_returns_centre_for_centre_role(client):
    lab = Lab.objects.create(name="Apollo Diagnostics", location="Delhi")
    centre = Centre.objects.create(lab=lab, name="Apollo - CP", location="Connaught Place")
    user = User.objects.create_user(
        email="centre@example.com",
        password="a-strong-passw0rd",
        role=User.Role.CENTRE,
        centre=centre,
    )
    client.force_authenticate(user=user)

    response = client.get("/auth/me/")

    assert response.status_code == 200
    assert response.data["role"] == "CENTRE"
    assert response.data["centre"] == centre.id


@pytest.mark.django_db
def test_me_requires_authentication(client):
    response = client.get("/auth/me/")

    assert response.status_code == 401
