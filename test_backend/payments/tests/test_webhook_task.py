import json
from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest
import requests
from django.conf import settings
from django.utils import timezone
from kombu.exceptions import OperationalError
from rest_framework.test import APIClient

from accounts.models import User
from bookings.models import Booking
from catalog.models import Centre, CentreTest, Lab, Test
from payments.models import Payment
from payments.tasks import deliver_payment_webhook
from payments.webhook_security import verify_signature


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
    return client_user, payment


def test_task_posts_signed_event_to_webhook():
    with patch("payments.tasks.requests.post") as post:
        deliver_payment_webhook("0b7c5f3e-5d7c-4a36-9b1e-2f0f6f7d8a11", "SUCCESS")

    url = post.call_args.args[0]
    body = post.call_args.kwargs["data"]
    headers = post.call_args.kwargs["headers"]
    payload = json.loads(body)
    assert url == f"{settings.INTERNAL_BASE_URL}/payments/webhook/"
    assert payload["payment_reference"] == "0b7c5f3e-5d7c-4a36-9b1e-2f0f6f7d8a11"
    assert payload["status"] == "SUCCESS"
    assert payload["event_id"]
    assert verify_signature(body, headers["X-Webhook-Signature"])


def test_task_uses_a_fresh_event_id_per_delivery():
    with patch("payments.tasks.requests.post") as post:
        deliver_payment_webhook("0b7c5f3e-5d7c-4a36-9b1e-2f0f6f7d8a11", "SUCCESS")
        deliver_payment_webhook("0b7c5f3e-5d7c-4a36-9b1e-2f0f6f7d8a11", "SUCCESS")

    first, second = (json.loads(call.kwargs["data"])["event_id"] for call in post.call_args_list)
    assert first != second


def test_task_logs_non_2xx_webhook_responses(caplog):
    response = MagicMock()
    response.raise_for_status.side_effect = requests.HTTPError("400 DisallowedHost")
    with patch("payments.tasks.requests.post", return_value=response):
        deliver_payment_webhook("0b7c5f3e-5d7c-4a36-9b1e-2f0f6f7d8a11", "FAILED")

    assert "Webhook delivery failed" in caplog.text


@pytest.mark.django_db
def test_simulate_enqueues_webhook_with_resolved_status(webhook_task, initiated_payment):
    client_user, payment = initiated_payment
    client = APIClient()
    client.force_authenticate(user=client_user)

    client.post("/payments/", {"payment_reference": str(payment.reference), "outcome": "FAILED"})

    webhook_task.apply_async.assert_called_once()
    call = webhook_task.apply_async.call_args
    assert call.kwargs["args"] == [str(payment.reference), "FAILED", "CARD_DECLINED"]
    assert 2 <= call.kwargs["countdown"] <= 8


@pytest.mark.django_db
def test_simulate_still_succeeds_when_broker_is_down(webhook_task, initiated_payment):
    client_user, payment = initiated_payment
    webhook_task.apply_async.side_effect = OperationalError("broker unreachable")
    client = APIClient()
    client.force_authenticate(user=client_user)

    response = client.post(
        "/payments/", {"payment_reference": str(payment.reference), "outcome": "SUCCESS"}
    )

    assert response.status_code == 200
    payment.refresh_from_db()
    assert payment.status == Payment.Status.SUCCESS
