from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from catalog.models import Centre, CentreTest, Lab, Test


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def centre_test():
    lab = Lab.objects.create(name="Apollo Diagnostics", location="Delhi")
    centre = Centre.objects.create(lab=lab, name="Apollo - CP", location="Connaught Place")
    test = Test.objects.create(name="CBC", description="Complete blood count")
    return CentreTest.objects.create(centre=centre, test=test, price="350.00", is_active=True)


def future_datetime():
    return (timezone.now() + timedelta(days=2)).isoformat()


@pytest.mark.django_db
def test_client_creates_booking(client, centre_test):
    user = User.objects.create_user(email="client@example.com", password="a-strong-passw0rd")
    client.force_authenticate(user=user)

    response = client.post(
        "/bookings/", {"centre_test": centre_test.id, "appointment_at": future_datetime()}
    )

    assert response.status_code == 201
    assert response.data["status"] == "PENDING"
    assert response.data["amount"] == "350.00"
    assert response.data["client"] == user.id


@pytest.mark.django_db
def test_centre_creates_booking_for_own_centre(client, centre_test):
    user = User.objects.create_user(
        email="centre@example.com",
        password="a-strong-passw0rd",
        role=User.Role.CENTRE,
        centre=centre_test.centre,
    )
    client.force_authenticate(user=user)

    response = client.post(
        "/bookings/", {"centre_test": centre_test.id, "appointment_at": future_datetime()}
    )

    assert response.status_code == 201
    assert response.data["client"] is None


@pytest.mark.django_db
def test_centre_cannot_create_booking_for_other_centre(client, centre_test):
    other_centre = Centre.objects.create(
        lab=centre_test.centre.lab, name="Apollo - Dwarka", location="Dwarka"
    )
    user = User.objects.create_user(
        email="centre@example.com",
        password="a-strong-passw0rd",
        role=User.Role.CENTRE,
        centre=other_centre,
    )
    client.force_authenticate(user=user)

    response = client.post(
        "/bookings/", {"centre_test": centre_test.id, "appointment_at": future_datetime()}
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_lab_cannot_create_booking(client, centre_test):
    user = User.objects.create_user(
        email="lab@example.com",
        password="a-strong-passw0rd",
        role=User.Role.LAB,
        lab=centre_test.centre.lab,
    )
    client.force_authenticate(user=user)

    response = client.post(
        "/bookings/", {"centre_test": centre_test.id, "appointment_at": future_datetime()}
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_unauthenticated_cannot_create_booking(client, centre_test):
    response = client.post(
        "/bookings/", {"centre_test": centre_test.id, "appointment_at": future_datetime()}
    )

    assert response.status_code == 401


@pytest.mark.django_db
def test_cannot_book_inactive_centre_test(client, centre_test):
    centre_test.is_active = False
    centre_test.save()
    user = User.objects.create_user(email="client@example.com", password="a-strong-passw0rd")
    client.force_authenticate(user=user)

    response = client.post(
        "/bookings/", {"centre_test": centre_test.id, "appointment_at": future_datetime()}
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_cannot_book_past_appointment(client, centre_test):
    user = User.objects.create_user(email="client@example.com", password="a-strong-passw0rd")
    client.force_authenticate(user=user)
    past = (timezone.now() - timedelta(days=1)).isoformat()

    response = client.post("/bookings/", {"centre_test": centre_test.id, "appointment_at": past})

    assert response.status_code == 400
