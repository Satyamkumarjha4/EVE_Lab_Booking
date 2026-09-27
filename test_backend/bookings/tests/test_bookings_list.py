from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from bookings.models import Booking
from catalog.models import Centre, CentreTest, Lab, Test


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def two_clients_bookings():
    lab = Lab.objects.create(name="Apollo Diagnostics", location="Delhi")
    centre = Centre.objects.create(lab=lab, name="Apollo - CP", location="Connaught Place")
    test = Test.objects.create(name="CBC", description="Complete blood count")
    centre_test = CentreTest.objects.create(centre=centre, test=test, price="350.00")

    client_a = User.objects.create_user(email="a@example.com", password="a-strong-passw0rd")
    client_b = User.objects.create_user(email="b@example.com", password="a-strong-passw0rd")

    appointment = timezone.now() + timedelta(days=2)
    booking_a = Booking.objects.create(
        client=client_a, centre_test=centre_test, appointment_at=appointment, amount=350
    )
    booking_b = Booking.objects.create(
        client=client_b, centre_test=centre_test, appointment_at=appointment, amount=350
    )
    return client_a, client_b, booking_a, booking_b, centre, lab


@pytest.mark.django_db
def test_client_sees_only_own_bookings(client, two_clients_bookings):
    client_a, _client_b, booking_a, _booking_b, _centre, _lab = two_clients_bookings
    client.force_authenticate(user=client_a)

    response = client.get("/bookings/")

    assert response.status_code == 200
    assert [b["id"] for b in response.data] == [booking_a.id]


@pytest.mark.django_db
def test_lab_sees_own_centres_bookings(client, two_clients_bookings):
    _client_a, _client_b, booking_a, booking_b, _centre, lab = two_clients_bookings
    lab_user = User.objects.create_user(
        email="lab@example.com", password="a-strong-passw0rd", role=User.Role.LAB, lab=lab
    )
    client.force_authenticate(user=lab_user)

    response = client.get("/bookings/")

    assert response.status_code == 200
    assert {b["id"] for b in response.data} == {booking_a.id, booking_b.id}


@pytest.mark.django_db
def test_centre_sees_own_centre_bookings(client, two_clients_bookings):
    _client_a, _client_b, booking_a, booking_b, centre, _lab = two_clients_bookings
    centre_user = User.objects.create_user(
        email="centre@example.com",
        password="a-strong-passw0rd",
        role=User.Role.CENTRE,
        centre=centre,
    )
    client.force_authenticate(user=centre_user)

    response = client.get("/bookings/")

    assert response.status_code == 200
    assert {b["id"] for b in response.data} == {booking_a.id, booking_b.id}


@pytest.mark.django_db
def test_platform_admin_sees_all_bookings(client, two_clients_bookings):
    _client_a, _client_b, booking_a, booking_b, _centre, _lab = two_clients_bookings
    admin_user = User.objects.create_user(
        email="admin@example.com",
        password="a-strong-passw0rd",
        role=User.Role.PLATFORM_ADMIN,
    )
    client.force_authenticate(user=admin_user)

    response = client.get("/bookings/")

    assert response.status_code == 200
    assert {b["id"] for b in response.data} == {booking_a.id, booking_b.id}


@pytest.mark.django_db
def test_detail_invalid_id_returns_404(client, two_clients_bookings):
    client_a, *_ = two_clients_bookings
    client.force_authenticate(user=client_a)

    response = client.get("/bookings/999999/")

    assert response.status_code == 404


@pytest.mark.django_db
def test_client_cannot_view_other_clients_booking(client, two_clients_bookings):
    client_a, _client_b, _booking_a, booking_b, _centre, _lab = two_clients_bookings
    client.force_authenticate(user=client_a)

    response = client.get(f"/bookings/{booking_b.id}/")

    assert response.status_code == 404
