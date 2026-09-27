from collections import Counter
from decimal import ROUND_HALF_UP, Decimal

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.utils import timezone

from accounts.models import User
from bookings.models import Booking
from payments.models import Payment
from scheduling.services import local_tz, rules_for_day


@pytest.fixture
def seeded():
    call_command("seed_demo_data")
    call_command("seed_demo_bookings")


@pytest.mark.django_db
def test_requires_catalog():
    with pytest.raises(CommandError):
        call_command("seed_demo_bookings")


@pytest.mark.django_db
def test_seeds_backdated_history_for_the_demo_lab(seeded):
    lab_user = User.objects.get(email="lab@demo.eve")
    lab_bookings = Booking.objects.for_user(lab_user)

    assert lab_bookings.count() >= 100
    oldest = lab_bookings.order_by("created_at").first().created_at
    assert (timezone.now() - oldest).days >= 60
    assert lab_bookings.filter(appointment_at__gt=timezone.now()).exists()
    lifecycle = {
        Booking.Status.CONFIRMED,
        Booking.Status.COMPLETED,
        Booking.Status.REPORT_DELIVERED,
        Booking.Status.NO_SHOW,
        Booking.Status.FAILED,
        Booking.Status.CANCELLED,
    }
    assert lifecycle <= set(lab_bookings.values_list("status", flat=True))


@pytest.mark.django_db
def test_history_and_payments_match_each_booking(seeded):
    bookings = Booking.objects.select_related("centre_test__centre__lab", "payment")
    for booking in bookings.prefetch_related("events"):
        events = list(booking.events.all())
        assert events[0].status == Booking.Status.PENDING
        assert events[-1].status == booking.status
        assert booking.amount == booking.centre_test.price

        payment = getattr(booking, "payment", None)
        fee_percent = booking.centre_test.centre.lab.transaction_fee_percent
        if booking.status in (
            Booking.Status.CONFIRMED,
            Booking.Status.COMPLETED,
            Booking.Status.REPORT_DELIVERED,
        ):
            assert payment.status == Payment.Status.SUCCESS
            assert payment.refund_status == Payment.RefundStatus.NONE
        elif booking.status == Booking.Status.NO_SHOW:
            expected_fee = (booking.amount * fee_percent / 100).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            assert payment.fee_amount == expected_fee
            assert payment.refund_amount + payment.fee_amount == booking.amount
        elif booking.status == Booking.Status.FAILED:
            assert payment.failure_reason
            assert events[-1].note
        elif booking.status == Booking.Status.CANCELLED:
            assert events[-1].note
            if payment is not None:
                assert payment.refund_amount + payment.fee_amount == booking.amount


@pytest.mark.django_db
def test_appointments_respect_each_centres_slots(seeded):
    seats = Counter(Booking.objects.values_list("centre_test__centre", "appointment_at"))
    rules_by_centre = {}
    for (centre_id, appointment_at), taken in seats.items():
        if centre_id not in rules_by_centre:
            booking = Booking.objects.filter(centre_test__centre=centre_id).first()
            rules_by_centre[centre_id] = list(booking.centre_test.centre.slot_rules.all())
        local = appointment_at.astimezone(local_tz())
        rules, _ = rules_for_day(rules_by_centre[centre_id], local.date())
        rule = next(r for r in rules if r.start_time <= local.time() < r.end_time)
        assert local.minute in (0, 30)
        assert taken <= rule.capacity


@pytest.mark.django_db
def test_demo_client_gets_bookings_in_every_state(seeded):
    client = User.objects.get(email="client@demo.eve")
    statuses = set(Booking.objects.filter(client=client).values_list("status", flat=True))

    assert statuses == set(Booking.Status.values)
    assert client.full_name == "Riya Sharma"


@pytest.mark.django_db
def test_is_idempotent(seeded):
    count = Booking.objects.count()

    call_command("seed_demo_bookings")

    assert Booking.objects.count() == count
