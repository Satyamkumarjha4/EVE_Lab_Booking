import uuid
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
def initiated_payment():
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
    payment = Payment.objects.create(booking=booking, amount=booking.amount, method="CARD")
    return client_user, booking, payment


@pytest.mark.django_db
def test_simulate_success_confirms_booking(client, initiated_payment):
    client_user, booking, payment = initiated_payment
    client.force_authenticate(user=client_user)

    response = client.post(
        "/payments/", {"payment_reference": str(payment.reference), "outcome": "SUCCESS"}
    )

    assert response.status_code == 200
    payment.refresh_from_db()
    booking.refresh_from_db()
    assert payment.status == Payment.Status.SUCCESS
    assert booking.status == Booking.Status.CONFIRMED


@pytest.mark.django_db
def test_simulate_failed_fails_booking(client, initiated_payment):
    client_user, booking, payment = initiated_payment
    client.force_authenticate(user=client_user)

    response = client.post(
        "/payments/", {"payment_reference": str(payment.reference), "outcome": "FAILED"}
    )

    assert response.status_code == 200
    payment.refresh_from_db()
    booking.refresh_from_db()
    assert payment.status == Payment.Status.FAILED
    assert booking.status == Booking.Status.FAILED


@pytest.mark.django_db
def test_double_submit_returns_409(client, initiated_payment):
    client_user, _booking, payment = initiated_payment
    client.force_authenticate(user=client_user)

    first = client.post(
        "/payments/", {"payment_reference": str(payment.reference), "outcome": "SUCCESS"}
    )
    second = client.post(
        "/payments/", {"payment_reference": str(payment.reference), "outcome": "FAILED"}
    )

    assert first.status_code == 200
    assert second.status_code == 409


@pytest.mark.django_db
def test_unknown_reference_returns_404(client, initiated_payment):
    client_user, _booking, _payment = initiated_payment
    client.force_authenticate(user=client_user)

    response = client.post(
        "/payments/", {"payment_reference": str(uuid.uuid4()), "outcome": "SUCCESS"}
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_wrong_owner_cannot_simulate(client, initiated_payment):
    _client_user, _booking, payment = initiated_payment
    other_client = User.objects.create_user(email="other@example.com", password="a-strong-passw0rd")
    client.force_authenticate(user=other_client)

    response = client.post(
        "/payments/", {"payment_reference": str(payment.reference), "outcome": "SUCCESS"}
    )

    assert response.status_code == 403
