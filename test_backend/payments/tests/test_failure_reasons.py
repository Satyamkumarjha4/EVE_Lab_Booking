import uuid
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from bookings.models import Booking
from catalog.models import Centre, CentreTest, Lab, Test
from payments.models import Payment
from test_backend.payments.tests.test_payment_webhook import post_webhook


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def initiated_payment():
    lab = Lab.objects.create(name="Apollo Diagnostics", location="Delhi")
    centre = Centre.objects.create(lab=lab, name="Apollo - CP", location="Connaught Place")
    centre_test = CentreTest.objects.create(
        centre=centre, test=Test.objects.create(name="CBC"), price="350.00"
    )
    patient = User.objects.create_user(email="client@example.com", password="a-strong-passw0rd")
    booking = Booking.objects.create(
        client=patient,
        centre_test=centre_test,
        appointment_at=timezone.now() + timedelta(days=2),
        amount=350,
    )
    payment = Payment.objects.create(booking=booking, amount=booking.amount, method="CARD")
    return patient, booking, payment


def _simulate(client, payment, **body):
    return client.post("/payments/", {"payment_reference": str(payment.reference), **body})


@pytest.mark.django_db
def test_decline_reason_is_stored_and_logged_on_the_booking(client, initiated_payment):
    client_user, booking, payment = initiated_payment
    client.force_authenticate(user=client_user)

    response = _simulate(client, payment, outcome="FAILED", failure_reason="INSUFFICIENT_FUNDS")

    assert response.status_code == 200
    assert response.data["failure_reason"] == "INSUFFICIENT_FUNDS"
    booking.refresh_from_db()
    assert booking.status == Booking.Status.FAILED
    event = booking.events.get(status=Booking.Status.FAILED)
    assert (event.note, event.actor) == ("Insufficient funds", client_user)


@pytest.mark.django_db
def test_decline_without_a_reason_defaults_to_card_declined(client, initiated_payment):
    client_user, _booking, payment = initiated_payment
    client.force_authenticate(user=client_user)

    _simulate(client, payment, outcome="FAILED")

    payment.refresh_from_db()
    assert payment.failure_reason == Payment.FailureReason.CARD_DECLINED


@pytest.mark.django_db
def test_success_cannot_carry_a_failure_reason(client, initiated_payment):
    client_user, _booking, payment = initiated_payment
    client.force_authenticate(user=client_user)

    response = _simulate(client, payment, outcome="SUCCESS", failure_reason="TIMED_OUT")

    assert response.status_code == 400


@pytest.mark.django_db
def test_webhook_carries_the_failure_reason(client, initiated_payment):
    _client_user, booking, payment = initiated_payment

    response = post_webhook(
        client,
        {
            "event_id": str(uuid.uuid4()),
            "payment_reference": str(payment.reference),
            "status": "FAILED",
            "failure_reason": "BANK_UNAVAILABLE",
        },
    )

    assert response.status_code == 200
    payment.refresh_from_db()
    assert payment.failure_reason == Payment.FailureReason.BANK_UNAVAILABLE
    event = booking.events.get(status=Booking.Status.FAILED)
    assert event.actor_role == "SYSTEM"
