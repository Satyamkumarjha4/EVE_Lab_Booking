import json
import uuid
from datetime import timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from bookings.models import Booking
from catalog.models import Centre, CentreTest, Lab, Test
from payments.models import Payment, PaymentEvent
from payments.webhook_security import sign_payload


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


def post_webhook(client, payload, sign=True, signature=None):
    body = json.dumps(payload).encode()
    headers = {"content_type": "application/json"}
    if sign:
        headers["HTTP_X_WEBHOOK_SIGNATURE"] = sign_payload(body)
    elif signature is not None:
        headers["HTTP_X_WEBHOOK_SIGNATURE"] = signature
    return client.post("/payments/webhook/", data=body, **headers)


@pytest.mark.django_db
def test_webhook_resolves_initiated_payment(client, initiated_payment):
    _client_user, booking, payment = initiated_payment
    payload = {
        "event_id": str(uuid.uuid4()),
        "payment_reference": str(payment.reference),
        "status": "SUCCESS",
    }

    response = post_webhook(client, payload)

    assert response.status_code == 200
    payment.refresh_from_db()
    booking.refresh_from_db()
    assert payment.status == Payment.Status.SUCCESS
    assert booking.status == Booking.Status.CONFIRMED
    event = PaymentEvent.objects.get(event_id=payload["event_id"])
    assert event.processed_at is not None


@pytest.mark.django_db
def test_duplicate_event_id_applied_once(client, initiated_payment):
    _client_user, _booking, payment = initiated_payment
    payload = {
        "event_id": str(uuid.uuid4()),
        "payment_reference": str(payment.reference),
        "status": "SUCCESS",
    }

    first = post_webhook(client, payload)
    second = post_webhook(client, payload)

    assert first.status_code == 200
    assert second.status_code == 200
    assert PaymentEvent.objects.filter(event_id=payload["event_id"]).count() == 1


@pytest.mark.django_db
def test_tampered_replay_is_logged_but_does_not_change_state(client, initiated_payment, caplog):
    _client_user, booking, payment = initiated_payment
    event_id = str(uuid.uuid4())
    first_payload = {
        "event_id": event_id,
        "payment_reference": str(payment.reference),
        "status": "SUCCESS",
    }
    # Same event_id, validly signed, but a different outcome than the original delivery.
    tampered_payload = {**first_payload, "status": "FAILED"}

    first = post_webhook(client, first_payload)
    with caplog.at_level("WARNING", logger="payments.views"):
        second = post_webhook(client, tampered_payload)

    assert first.status_code == 200
    assert second.status_code == 200
    assert PaymentEvent.objects.filter(event_id=event_id).count() == 1
    payment.refresh_from_db()
    booking.refresh_from_db()
    # State stays exactly what the first, genuine delivery set — the tampered replay is a no-op.
    assert payment.status == Payment.Status.SUCCESS
    assert booking.status == Booking.Status.CONFIRMED
    assert any("different payload" in record.message for record in caplog.records)


@pytest.mark.django_db
def test_conflicting_out_of_order_event_keeps_sync_result(client, initiated_payment):
    client_user, booking, payment = initiated_payment
    client.force_authenticate(user=client_user)

    sync_response = client.post(
        "/payments/", {"payment_reference": str(payment.reference), "outcome": "SUCCESS"}
    )
    assert sync_response.status_code == 200

    client.force_authenticate(user=None)
    webhook_payload = {
        "event_id": str(uuid.uuid4()),
        "payment_reference": str(payment.reference),
        "status": "FAILED",
    }
    response = post_webhook(client, webhook_payload)

    assert response.status_code == 200
    payment.refresh_from_db()
    booking.refresh_from_db()
    assert payment.status == Payment.Status.SUCCESS
    assert booking.status == Booking.Status.CONFIRMED


@pytest.mark.django_db
def test_late_success_for_cancelled_booking_is_refunded_not_confirmed(client, initiated_payment):
    client_user, booking, payment = initiated_payment
    client.force_authenticate(user=client_user)
    cancel = client.post(f"/bookings/{booking.id}/cancel/", {"reason": "Changed my mind"})
    assert cancel.status_code == 200
    client.force_authenticate(user=None)

    response = post_webhook(
        client,
        {
            "event_id": str(uuid.uuid4()),
            "payment_reference": str(payment.reference),
            "status": "SUCCESS",
        },
    )

    assert response.status_code == 200
    payment.refresh_from_db()
    booking.refresh_from_db()
    assert booking.status == Booking.Status.CANCELLED
    assert payment.status == Payment.Status.SUCCESS
    assert payment.refund_status == Payment.RefundStatus.SIMULATED_REFUNDED
    # Captured after the booking was cancelled: the patient isn't charged a fee.
    assert payment.refund_amount == payment.amount


@pytest.mark.django_db
def test_event_is_not_recorded_when_processing_fails(client, initiated_payment):
    _client_user, booking, payment = initiated_payment
    payload = {
        "event_id": str(uuid.uuid4()),
        "payment_reference": str(payment.reference),
        "status": "SUCCESS",
    }

    with patch("payments.views.apply_payment_result", side_effect=RuntimeError("boom")):
        with pytest.raises(RuntimeError):
            post_webhook(client, payload)
    assert not PaymentEvent.objects.filter(event_id=payload["event_id"]).exists()

    redelivery = post_webhook(client, payload)

    assert redelivery.status_code == 200
    booking.refresh_from_db()
    assert booking.status == Booking.Status.CONFIRMED


@pytest.mark.django_db
def test_webhook_missing_signature_rejected(client, initiated_payment):
    _client_user, _booking, payment = initiated_payment
    payload = {
        "event_id": str(uuid.uuid4()),
        "payment_reference": str(payment.reference),
        "status": "SUCCESS",
    }

    response = post_webhook(client, payload, sign=False)

    assert response.status_code == 403


@pytest.mark.django_db
def test_webhook_invalid_signature_rejected(client, initiated_payment):
    _client_user, _booking, payment = initiated_payment
    payload = {
        "event_id": str(uuid.uuid4()),
        "payment_reference": str(payment.reference),
        "status": "SUCCESS",
    }

    response = post_webhook(client, payload, sign=False, signature="not-the-right-signature")

    assert response.status_code == 403


@pytest.mark.django_db
def test_webhook_unknown_payment_reference_returns_404(client):
    payload = {
        "event_id": str(uuid.uuid4()),
        "payment_reference": str(uuid.uuid4()),
        "status": "SUCCESS",
    }

    response = post_webhook(client, payload)

    assert response.status_code == 404
