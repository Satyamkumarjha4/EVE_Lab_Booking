from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from accounts.models import User
from bookings.models import Booking, BookingEvent
from bookings.tasks import expire_unpaid_bookings, mark_no_shows
from catalog.models import Centre, CentreTest, Lab, Test
from payments.models import Payment
from payments.services import apply_payment_result


@pytest.fixture
def centre_test():
    lab = Lab.objects.create(name="Apollo", location="Delhi", transaction_fee_percent=10)
    centre = Centre.objects.create(lab=lab, name="Apollo - CP", location="CP")
    return CentreTest.objects.create(
        centre=centre, test=Test.objects.create(name="CBC"), price="400"
    )


def _booking(centre_test, status, appointment_at, created_ago=timedelta(0)):
    patient, _ = User.objects.get_or_create(email="p@example.com")
    booking = Booking.objects.create(
        client=patient,
        centre_test=centre_test,
        appointment_at=appointment_at,
        amount=400,
        status=status,
    )
    Booking.objects.filter(pk=booking.pk).update(created_at=timezone.now() - created_ago)
    return booking


@pytest.mark.django_db
def test_no_show_after_grace_keeps_the_fee_and_refunds_the_rest(centre_test):
    booking = _booking(centre_test, Booking.Status.CONFIRMED, timezone.now() - timedelta(hours=3))
    payment = Payment.objects.create(
        booking=booking, amount=400, method="UPI", status=Payment.Status.SUCCESS
    )

    assert mark_no_shows() == 1

    booking.refresh_from_db()
    payment.refresh_from_db()
    assert booking.status == Booking.Status.NO_SHOW
    assert (payment.fee_amount, payment.refund_amount) == (Decimal("40.00"), Decimal("360.00"))
    event = booking.events.get()
    assert (event.actor_role, event.actor) == (BookingEvent.ActorRole.SYSTEM, None)


@pytest.mark.django_db
def test_no_show_waits_for_the_grace_period(centre_test):
    booking = _booking(
        centre_test, Booking.Status.CONFIRMED, timezone.now() - timedelta(minutes=30)
    )

    assert mark_no_shows() == 0
    booking.refresh_from_db()
    assert booking.status == Booking.Status.CONFIRMED


@pytest.mark.django_db
def test_completed_bookings_are_never_marked_no_show(centre_test):
    _booking(centre_test, Booking.Status.COMPLETED, timezone.now() - timedelta(days=1))

    assert mark_no_shows() == 0


@pytest.mark.django_db
def test_unpaid_booking_expires_after_the_payment_window(centre_test):
    stale = _booking(
        centre_test,
        Booking.Status.PENDING,
        timezone.now() + timedelta(days=1),
        timedelta(minutes=45),
    )
    fresh = _booking(
        centre_test,
        Booking.Status.PENDING,
        timezone.now() + timedelta(days=1),
        timedelta(minutes=5),
    )

    assert expire_unpaid_bookings() == 1

    stale.refresh_from_db()
    fresh.refresh_from_db()
    assert stale.status == Booking.Status.CANCELLED
    assert fresh.status == Booking.Status.PENDING
    assert "Payment not completed" in stale.events.get().note


@pytest.mark.django_db
def test_payment_captured_after_expiry_is_refunded_in_full(centre_test):
    booking = _booking(
        centre_test, Booking.Status.PENDING, timezone.now() + timedelta(days=1), timedelta(hours=1)
    )
    payment = Payment.objects.create(booking=booking, amount=400, method="CARD")
    expire_unpaid_bookings()

    apply_payment_result(payment, Payment.Status.SUCCESS)

    booking.refresh_from_db()
    payment.refresh_from_db()
    assert booking.status == Booking.Status.CANCELLED
    assert (payment.refund_amount, payment.fee_amount) == (Decimal("400.00"), Decimal("0.00"))
