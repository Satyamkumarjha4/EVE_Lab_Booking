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
def booking_setup():
    lab = Lab.objects.create(name="Apollo Diagnostics", location="Delhi")
    centre = Centre.objects.create(lab=lab, name="Apollo - CP", location="Connaught Place")
    test = Test.objects.create(name="CBC", description="Complete blood count")
    centre_test = CentreTest.objects.create(centre=centre, test=test, price="350.00")
    client_user = User.objects.create_user(email="client@example.com", password="a-strong-passw0rd")
    appointment = timezone.now() + timedelta(days=2)
    booking = Booking.objects.create(
        client=client_user, centre_test=centre_test, appointment_at=appointment, amount=350
    )
    return client_user, booking, centre, lab


@pytest.mark.django_db
def test_client_cancels_own_pending_booking(client, booking_setup):
    client_user, booking, _centre, _lab = booking_setup
    client.force_authenticate(user=client_user)

    response = client.post(f"/bookings/{booking.id}/cancel/")

    assert response.status_code == 200
    booking.refresh_from_db()
    assert booking.status == Booking.Status.CANCELLED


@pytest.mark.django_db
def test_cancel_confirmed_booking_flags_refund(client, booking_setup):
    client_user, booking, _centre, _lab = booking_setup
    booking.status = Booking.Status.CONFIRMED
    booking.save()
    payment = Payment.objects.create(
        booking=booking, amount=booking.amount, method="CARD", status=Payment.Status.SUCCESS
    )
    client.force_authenticate(user=client_user)

    response = client.post(f"/bookings/{booking.id}/cancel/")

    assert response.status_code == 200
    booking.refresh_from_db()
    payment.refresh_from_db()
    assert booking.status == Booking.Status.CANCELLED
    assert payment.refund_status == Payment.RefundStatus.SIMULATED_REFUNDED


@pytest.mark.django_db
def test_client_cannot_cancel_someone_elses_booking(client, booking_setup):
    _client_user, booking, _centre, _lab = booking_setup
    other_client = User.objects.create_user(email="other@example.com", password="a-strong-passw0rd")
    client.force_authenticate(user=other_client)

    response = client.post(f"/bookings/{booking.id}/cancel/")

    assert response.status_code == 404


@pytest.mark.django_db
def test_lab_cancels_own_centre_booking(client, booking_setup):
    _client_user, booking, _centre, lab = booking_setup
    lab_user = User.objects.create_user(
        email="lab@example.com", password="a-strong-passw0rd", role=User.Role.LAB, lab=lab
    )
    client.force_authenticate(user=lab_user)

    response = client.post(f"/bookings/{booking.id}/cancel/")

    assert response.status_code == 200


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

    response = client.post(f"/bookings/{booking.id}/cancel/")

    assert response.status_code == 403


@pytest.mark.django_db
def test_cannot_cancel_already_cancelled_booking(client, booking_setup):
    client_user, booking, _centre, _lab = booking_setup
    booking.status = Booking.Status.CANCELLED
    booking.save()
    client.force_authenticate(user=client_user)

    response = client.post(f"/bookings/{booking.id}/cancel/")

    assert response.status_code == 409


@pytest.mark.django_db
def test_cannot_cancel_failed_booking(client, booking_setup):
    client_user, booking, _centre, _lab = booking_setup
    booking.status = Booking.Status.FAILED
    booking.save()
    client.force_authenticate(user=client_user)

    response = client.post(f"/bookings/{booking.id}/cancel/")

    assert response.status_code == 409


@pytest.mark.django_db
def test_simulating_payment_after_cancel_is_rejected(client, booking_setup):
    client_user, booking, _centre, _lab = booking_setup
    payment = Payment.objects.create(booking=booking, amount=booking.amount, method="CARD")
    client.force_authenticate(user=client_user)
    client.post(f"/bookings/{booking.id}/cancel/")

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

    response = client.post("/bookings/999999/cancel/")

    assert response.status_code == 404
