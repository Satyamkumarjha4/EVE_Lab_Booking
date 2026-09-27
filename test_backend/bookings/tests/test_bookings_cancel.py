from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from bookings.models import Booking
from catalog.models import Centre, CentreTest, Lab, Test
from payments.models import Payment

REASON = {"reason": "Schedule conflict"}


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def booking_setup():
    lab = Lab.objects.create(name="Apollo Diagnostics", location="Delhi", transaction_fee_percent=5)
    centre = Centre.objects.create(lab=lab, name="Apollo - CP", location="Connaught Place")
    test = Test.objects.create(name="CBC", description="Complete blood count")
    centre_test = CentreTest.objects.create(centre=centre, test=test, price="350.00")
    client_user = User.objects.create_user(email="client@example.com", password="a-strong-passw0rd")
    appointment = timezone.now() + timedelta(days=2)
    booking = Booking.objects.create(
        client=client_user, centre_test=centre_test, appointment_at=appointment, amount=350
    )
    return client_user, booking, centre, lab


def _lab_user(lab):
    return User.objects.create_user(
        email="lab@example.com", password="a-strong-passw0rd", role=User.Role.LAB, lab=lab
    )


def _paid(booking):
    booking.status = Booking.Status.CONFIRMED
    booking.save()
    return Payment.objects.create(
        booking=booking, amount=booking.amount, method="CARD", status=Payment.Status.SUCCESS
    )


@pytest.mark.django_db
def test_client_cancels_own_pending_booking_with_reason(client, booking_setup):
    client_user, booking, _centre, _lab = booking_setup
    client.force_authenticate(user=client_user)

    response = client.post(f"/bookings/{booking.id}/cancel/", REASON)

    assert response.status_code == 200
    assert response.data["status"] == Booking.Status.CANCELLED
    assert response.data["cancellation"]["reason"] == "Schedule conflict"
    assert response.data["cancellation"]["by_role"] == "CLIENT"
    event = booking.events.get(status=Booking.Status.CANCELLED)
    assert (event.actor, event.note) == (client_user, "Schedule conflict")


@pytest.mark.django_db
def test_reason_is_required(client, booking_setup):
    client_user, booking, _centre, _lab = booking_setup
    client.force_authenticate(user=client_user)

    response = client.post(f"/bookings/{booking.id}/cancel/", {"reason": "  "})

    assert response.status_code == 400
    booking.refresh_from_db()
    assert booking.status == Booking.Status.PENDING


@pytest.mark.django_db
def test_client_cancelling_a_paid_booking_pays_the_lab_fee(client, booking_setup):
    client_user, booking, _centre, _lab = booking_setup
    payment = _paid(booking)
    client.force_authenticate(user=client_user)

    response = client.post(f"/bookings/{booking.id}/cancel/", REASON)

    assert response.status_code == 200
    payment.refresh_from_db()
    assert payment.refund_status == Payment.RefundStatus.SIMULATED_REFUNDED
    assert payment.fee_amount == Decimal("17.50")
    assert payment.refund_amount == Decimal("332.50")
    assert response.data["payment"]["refund_amount"] == "332.50"


@pytest.mark.django_db
def test_lab_cancelling_a_paid_booking_refunds_in_full(client, booking_setup):
    _client_user, booking, _centre, lab = booking_setup
    payment = _paid(booking)
    client.force_authenticate(user=_lab_user(lab))

    response = client.post(f"/bookings/{booking.id}/cancel/", {"reason": "Analyser down"})

    assert response.status_code == 200
    assert response.data["cancellation"]["by_role"] == "LAB"
    payment.refresh_from_db()
    assert (payment.refund_amount, payment.fee_amount) == (Decimal("350.00"), Decimal("0.00"))


@pytest.mark.django_db
def test_cannot_cancel_once_the_appointment_has_passed(client, booking_setup):
    client_user, booking, _centre, _lab = booking_setup
    _paid(booking)
    Booking.objects.filter(pk=booking.pk).update(appointment_at=timezone.now() - timedelta(hours=1))
    client.force_authenticate(user=client_user)

    response = client.post(f"/bookings/{booking.id}/cancel/", REASON)

    assert response.status_code == 409


@pytest.mark.django_db
def test_client_cannot_cancel_someone_elses_booking(client, booking_setup):
    _client_user, booking, _centre, _lab = booking_setup
    other_client = User.objects.create_user(email="other@example.com", password="a-strong-passw0rd")
    client.force_authenticate(user=other_client)

    response = client.post(f"/bookings/{booking.id}/cancel/", REASON)

    assert response.status_code == 404


@pytest.mark.django_db
def test_centre_cannot_cancel_booking(client, booking_setup):
    _client_user, booking, centre, _lab = booking_setup
    centre_user = User.objects.create_user(
        email="centre@example.com",
        password="a-strong-passw0rd",
        role=User.Role.CENTRE,
        centre=centre,
    )
    client.force_authenticate(user=centre_user)

    response = client.post(f"/bookings/{booking.id}/cancel/", REASON)

    assert response.status_code == 403


@pytest.mark.django_db
@pytest.mark.parametrize(
    "status",
    [
        Booking.Status.CANCELLED,
        Booking.Status.FAILED,
        Booking.Status.COMPLETED,
        Booking.Status.NO_SHOW,
        Booking.Status.REPORT_DELIVERED,
    ],
)
def test_only_pending_or_confirmed_bookings_can_be_cancelled(client, booking_setup, status):
    client_user, booking, _centre, _lab = booking_setup
    booking.status = status
    booking.save()
    client.force_authenticate(user=client_user)

    response = client.post(f"/bookings/{booking.id}/cancel/", REASON)

    assert response.status_code == 409


@pytest.mark.django_db
def test_simulating_payment_after_cancel_is_rejected(client, booking_setup):
    client_user, booking, _centre, _lab = booking_setup
    payment = Payment.objects.create(booking=booking, amount=booking.amount, method="CARD")
    client.force_authenticate(user=client_user)
    client.post(f"/bookings/{booking.id}/cancel/", REASON)

    response = client.post(
        "/payments/", {"payment_reference": str(payment.reference), "outcome": "SUCCESS"}
    )

    assert response.status_code == 409
    booking.refresh_from_db()
    payment.refresh_from_db()
    assert booking.status == Booking.Status.CANCELLED
    assert payment.status == Payment.Status.INITIATED


@pytest.mark.django_db
def test_cancel_invalid_booking_id_returns_404(client, booking_setup):
    client_user, _booking, _centre, _lab = booking_setup
    client.force_authenticate(user=client_user)

    response = client.post("/bookings/999999/cancel/", REASON)

    assert response.status_code == 404
