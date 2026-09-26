from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from bookings.models import Booking
from catalog.models import Centre, CentreTest, Lab, Test
from payments.models import Payment


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def pending_booking():
    lab = Lab.objects.create(name="Apollo Diagnostics", location="Delhi")
    centre = Centre.objects.create(lab=lab, name="Apollo - CP", location="Connaught Place")
    test = Test.objects.create(name="CBC", description="Complete blood count")
    centre_test = CentreTest.objects.create(centre=centre, test=test, price="350.00")
    client_user = User.objects.create_user(email="client@example.com", password="a-strong-passw0rd")
    booking = Booking.objects.create(
        client=client_user,
        centre_test=centre_test,
        appointment_at=timezone.now() + timedelta(days=2),
        amount=350,
    )
    return client_user, booking, centre


@pytest.mark.django_db
def test_client_creates_order_for_own_booking(client, pending_booking):
    client_user, booking, _centre = pending_booking
    client.force_authenticate(user=client_user)

    response = client.post("/payments/orders/", {"booking": booking.id, "method": "CARD"})

    assert response.status_code == 201
    assert response.data["status"] == "INITIATED"
    assert response.data["reference"]


@pytest.mark.django_db
def test_centre_creates_order_for_own_booking(client, pending_booking):
    _client_user, booking, centre = pending_booking
    centre_user = User.objects.create_user(
        email="centre@example.com",
        password="a-strong-passw0rd",
        role=User.Role.CENTRE,
        centre=centre,
    )
    client.force_authenticate(user=centre_user)

    response = client.post("/payments/orders/", {"booking": booking.id, "method": "UPI"})

    assert response.status_code == 201


@pytest.mark.django_db
def test_order_creation_rejects_wrong_owner(client, pending_booking):
    _client_user, booking, _centre = pending_booking
    other_client = User.objects.create_user(email="other@example.com", password="a-strong-passw0rd")
    client.force_authenticate(user=other_client)

    response = client.post("/payments/orders/", {"booking": booking.id, "method": "CARD"})

    assert response.status_code == 400


@pytest.mark.django_db
def test_order_creation_rejects_non_pending_booking(client, pending_booking):
    client_user, booking, _centre = pending_booking
    booking.status = Booking.Status.CANCELLED
    booking.save()
    client.force_authenticate(user=client_user)

    response = client.post("/payments/orders/", {"booking": booking.id, "method": "CARD"})

    assert response.status_code == 400


@pytest.mark.django_db
def test_order_creation_rejects_duplicate_order(client, pending_booking):
    client_user, booking, _centre = pending_booking
    Payment.objects.create(booking=booking, amount=booking.amount, method="CARD")
    client.force_authenticate(user=client_user)

    response = client.post("/payments/orders/", {"booking": booking.id, "method": "CARD"})

    assert response.status_code == 400
