import pytest
from rest_framework.test import APIClient

from accounts.models import User
from catalog.models import Centre, CentreTest, Lab, Test


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def centre_with_tests():
    lab = Lab.objects.create(name="Apollo Diagnostics", location="Delhi")
    centre = Centre.objects.create(lab=lab, name="Apollo - CP", location="Connaught Place")
    active_test = Test.objects.create(name="CBC", description="Complete blood count")
    inactive_test = Test.objects.create(name="Lipid Profile", description="Cholesterol panel")
    CentreTest.objects.create(centre=centre, test=active_test, price="350.00", is_active=True)
    CentreTest.objects.create(centre=centre, test=inactive_test, price="600.00", is_active=False)
    return centre


@pytest.mark.django_db
def test_returns_only_active_tests_with_price(client, centre_with_tests):
    response = client.get(f"/centres/{centre_with_tests.id}/tests/")

    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]["test"]["name"] == "CBC"
    assert response.data[0]["price"] == "350.00"


@pytest.mark.django_db
def test_nonexistent_centre_returns_404(client):
    response = client.get("/centres/999999/tests/")

    assert response.status_code == 404


@pytest.mark.django_db
def test_centre_role_can_view_own_centre_tests(client, centre_with_tests):
    user = User.objects.create_user(
        email="centre@example.com",
        password="a-strong-passw0rd",
        role=User.Role.CENTRE,
        centre=centre_with_tests,
    )
    client.force_authenticate(user=user)

    response = client.get(f"/centres/{centre_with_tests.id}/tests/")

    assert response.status_code == 200


@pytest.mark.django_db
def test_centre_role_cannot_view_other_centre_tests(client, centre_with_tests):
    lab = centre_with_tests.lab
    other_centre = Centre.objects.create(lab=lab, name="Apollo - Dwarka", location="Dwarka")
    user = User.objects.create_user(
        email="centre@example.com",
        password="a-strong-passw0rd",
        role=User.Role.CENTRE,
        centre=other_centre,
    )
    client.force_authenticate(user=user)

    response = client.get(f"/centres/{centre_with_tests.id}/tests/")

    assert response.status_code == 404
