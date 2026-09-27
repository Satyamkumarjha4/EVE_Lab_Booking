import pytest
from rest_framework.test import APIClient

from accounts.models import User
from catalog.models import Centre, Lab


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def two_centres():
    lab = Lab.objects.create(name="Apollo Diagnostics", location="Delhi")
    centre_a = Centre.objects.create(lab=lab, name="Apollo - CP", location="Connaught Place")
    centre_b = Centre.objects.create(lab=lab, name="Apollo - Dwarka", location="Dwarka")
    return centre_a, centre_b


@pytest.mark.django_db
def test_anonymous_sees_all_centres(client, two_centres):
    response = client.get("/centres/")

    assert response.status_code == 200
    assert len(response.data) == 2


@pytest.mark.django_db
def test_client_role_sees_all_centres(client, two_centres):
    user = User.objects.create_user(email="client@example.com", password="a-strong-passw0rd")
    client.force_authenticate(user=user)

    response = client.get("/centres/")

    assert response.status_code == 200
    assert len(response.data) == 2


@pytest.mark.django_db
def test_lab_role_sees_all_centres(client, two_centres):
    lab = two_centres[0].lab
    user = User.objects.create_user(
        email="lab@example.com", password="a-strong-passw0rd", role=User.Role.LAB, lab=lab
    )
    client.force_authenticate(user=user)

    response = client.get("/centres/")

    assert response.status_code == 200
    assert len(response.data) == 2


@pytest.mark.django_db
def test_centre_role_sees_only_own_centre(client, two_centres):
    centre_a, _centre_b = two_centres
    user = User.objects.create_user(
        email="centre@example.com",
        password="a-strong-passw0rd",
        role=User.Role.CENTRE,
        centre=centre_a,
    )
    client.force_authenticate(user=user)

    response = client.get("/centres/")

    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]["id"] == centre_a.id
