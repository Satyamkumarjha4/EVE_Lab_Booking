from datetime import time, timedelta

import pytest
from rest_framework.test import APIClient

from accounts.models import User
from bookings.models import Booking
from catalog.models import Centre, CentreTest, Lab, Test
from scheduling.models import SlotRule
from scheduling.services import create_default_schedule, local_today
from test_backend.scheduling.tests.utils import local_slot


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def centre():
    lab = Lab.objects.create(name="Apollo", location="Delhi")
    centre = Centre.objects.create(lab=lab, name="Apollo - CP", location="CP, Delhi")
    create_default_schedule(centre)
    return centre


def _day(client, centre, day, user=None):
    client.force_authenticate(user=user)
    response = client.get(f"/centres/{centre.id}/slots/?from={day.isoformat()}&days=1")
    assert response.status_code == 200
    return response.data[0]


@pytest.mark.django_db
def test_weekly_schedule_gives_every_half_hour_slot(client, centre):
    day = local_today() + timedelta(days=7)

    schedule = _day(client, centre, day)

    expected = 24 if day.weekday() < 6 else 10  # 07:00–19:00, or Sunday 08:00–13:00
    assert schedule["source"] == "weekly"
    assert len(schedule["slots"]) == expected
    assert all(s["capacity"] == (4 if day.weekday() < 6 else 2) for s in schedule["slots"])


@pytest.mark.django_db
def test_date_override_replaces_the_whole_day(client, centre):
    day = local_today() + timedelta(days=3)
    SlotRule.objects.create(
        centre=centre, date=day, start_time=time(10), end_time=time(12), capacity=5
    )
    SlotRule.objects.create(
        centre=centre, date=day, start_time=time(12), end_time=time(13), capacity=8
    )

    schedule = _day(client, centre, day)

    assert schedule["source"] == "override"
    assert [s["capacity"] for s in schedule["slots"]] == [5, 5, 5, 5, 8, 8]


@pytest.mark.django_db
def test_closed_day_has_no_bookable_slots(client, centre):
    day = local_today() + timedelta(days=3)
    SlotRule.objects.create(
        centre=centre, date=day, start_time=time(7), end_time=time(19), capacity=0
    )

    schedule = _day(client, centre, day)

    assert not any(s["bookable"] for s in schedule["slots"])


@pytest.mark.django_db
def test_booked_seats_reduce_what_remains(client, centre):
    slot = local_slot(days_ahead=3)
    centre_test = CentreTest.objects.create(
        centre=centre, test=Test.objects.create(name="CBC"), price=1
    )
    for status in (Booking.Status.CONFIRMED, Booking.Status.PENDING, Booking.Status.CANCELLED):
        Booking.objects.create(
            centre_test=centre_test, appointment_at=slot, amount=1, status=status
        )

    schedule = _day(client, centre, slot.date())

    ten = next(
        s for s in schedule["slots"] if s["start"].startswith(slot.date().isoformat() + "T10:00")
    )
    assert (ten["booked"], ten["remaining"], ten["bookable"]) == (2, ten["capacity"] - 2, True)


@pytest.mark.django_db
def test_past_slots_are_not_bookable_for_patients(client, centre):
    schedule = _day(client, centre, local_today() - timedelta(days=1))

    assert schedule["slots"] and not any(s["bookable"] for s in schedule["slots"])


@pytest.mark.django_db
def test_other_centres_staff_cannot_see_the_slots(client, centre):
    other = Centre.objects.create(lab=centre.lab, name="Apollo - Dwarka", location="Dwarka")
    staff = User.objects.create_user(email="c@example.com", role=User.Role.CENTRE, centre=other)
    client.force_authenticate(user=staff)

    assert client.get(f"/centres/{centre.id}/slots/").status_code == 404


@pytest.mark.django_db
def test_days_parameter_is_bounded(client, centre):
    assert client.get(f"/centres/{centre.id}/slots/?days=60").status_code == 400
