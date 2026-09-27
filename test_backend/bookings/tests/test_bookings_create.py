from datetime import time, timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from bookings.models import Booking
from catalog.models import Centre, CentreTest, Lab, Test
from scheduling.models import SlotRule
from scheduling.services import create_default_schedule, local_tz
from test_backend.scheduling.tests.utils import local_slot


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def centre_test():
    lab = Lab.objects.create(name="Apollo Diagnostics", location="Delhi")
    centre = Centre.objects.create(lab=lab, name="Apollo - CP", location="Connaught Place")
    create_default_schedule(centre)
    test = Test.objects.create(name="CBC", description="Complete blood count")
    return CentreTest.objects.create(centre=centre, test=test, price="350.00", is_active=True)


@pytest.fixture
def patient():
    return User.objects.create_user(email="client@example.com", password="a-strong-passw0rd")


def _centre_user(centre):
    return User.objects.create_user(
        email="centre@example.com",
        password="a-strong-passw0rd",
        role=User.Role.CENTRE,
        centre=centre,
    )


def _book(client, centre_test, at, **extra):
    return client.post(
        "/bookings/", {"centre_test": centre_test.id, "appointment_at": at.isoformat(), **extra}
    )


@pytest.mark.django_db
def test_client_creates_booking(client, centre_test, patient):
    client.force_authenticate(user=patient)

    response = _book(client, centre_test, local_slot())

    assert response.status_code == 201
    assert response.data["status"] == "PENDING"
    assert response.data["amount"] == "350.00"
    assert response.data["client"] == patient.id
    assert response.data["patient"]["email"] == patient.email
    assert [e["status"] for e in response.data["events"]] == ["PENDING"]


@pytest.mark.django_db
def test_centre_books_a_walk_in_for_a_patient(client, centre_test, patient):
    client.force_authenticate(user=_centre_user(centre_test.centre))

    response = _book(client, centre_test, local_slot(), patient=patient.id)

    assert response.status_code == 201
    assert response.data["client"] == patient.id
    assert response.data["events"][0]["actor_role"] == "CENTRE"


@pytest.mark.django_db
def test_centre_must_name_the_patient(client, centre_test):
    client.force_authenticate(user=_centre_user(centre_test.centre))

    response = _book(client, centre_test, local_slot())

    assert response.status_code == 400
    assert "patient" in response.data


@pytest.mark.django_db
def test_patient_must_be_a_client_account(client, centre_test):
    staff = _centre_user(centre_test.centre)
    client.force_authenticate(user=staff)

    response = _book(client, centre_test, local_slot(), patient=staff.id)

    assert response.status_code == 400


@pytest.mark.django_db
def test_client_cannot_book_for_someone_else(client, centre_test, patient):
    other = User.objects.create_user(email="other@example.com", password="a-strong-passw0rd")
    client.force_authenticate(user=patient)

    response = _book(client, centre_test, local_slot(), patient=other.id)

    assert response.status_code == 400


@pytest.mark.django_db
def test_centre_cannot_create_booking_for_other_centre(client, centre_test, patient):
    other_centre = Centre.objects.create(
        lab=centre_test.centre.lab, name="Apollo - Dwarka", location="Dwarka"
    )
    client.force_authenticate(user=_centre_user(other_centre))

    response = _book(client, centre_test, local_slot(), patient=patient.id)

    assert response.status_code == 403


@pytest.mark.django_db
def test_lab_cannot_create_booking(client, centre_test):
    user = User.objects.create_user(
        email="lab@example.com",
        password="a-strong-passw0rd",
        role=User.Role.LAB,
        lab=centre_test.centre.lab,
    )
    client.force_authenticate(user=user)

    assert _book(client, centre_test, local_slot()).status_code == 403


@pytest.mark.django_db
def test_unauthenticated_cannot_create_booking(client, centre_test):
    assert _book(client, centre_test, local_slot()).status_code == 401


@pytest.mark.django_db
def test_cannot_book_inactive_centre_test(client, centre_test, patient):
    centre_test.is_active = False
    centre_test.save()
    client.force_authenticate(user=patient)

    assert _book(client, centre_test, local_slot()).status_code == 400


@pytest.mark.django_db
def test_cannot_book_past_appointment(client, centre_test, patient):
    client.force_authenticate(user=patient)

    assert _book(client, centre_test, local_slot(days_ahead=-1)).status_code == 400


@pytest.mark.django_db
def test_appointment_must_start_on_a_slot_boundary(client, centre_test, patient):
    client.force_authenticate(user=patient)

    response = _book(client, centre_test, local_slot(at=time(10, 15)))

    assert response.status_code == 400
    assert "appointment_at" in response.data


@pytest.mark.django_db
def test_cannot_book_outside_opening_hours(client, centre_test, patient):
    client.force_authenticate(user=patient)

    assert _book(client, centre_test, local_slot(at=time(22))).status_code == 400


@pytest.mark.django_db
def test_full_slot_is_rejected_with_409(client, centre_test, patient):
    slot = local_slot()
    SlotRule.objects.create(
        centre=centre_test.centre,
        date=slot.date(),
        start_time=time(9),
        end_time=time(12),
        capacity=1,
    )
    client.force_authenticate(user=patient)
    assert _book(client, centre_test, slot).status_code == 201

    response = _book(client, centre_test, slot)

    assert response.status_code == 409
    assert Booking.objects.count() == 1


@pytest.mark.django_db
def test_cancelled_bookings_free_their_seat(client, centre_test, patient):
    slot = local_slot()
    SlotRule.objects.create(
        centre=centre_test.centre,
        date=slot.date(),
        start_time=time(9),
        end_time=time(12),
        capacity=1,
    )
    client.force_authenticate(user=patient)
    first = _book(client, centre_test, slot)
    Booking.objects.filter(pk=first.data["id"]).update(status=Booking.Status.CANCELLED)

    assert _book(client, centre_test, slot).status_code == 201


@pytest.mark.django_db
def test_patients_book_ahead_but_centres_can_use_the_current_slot(client, centre_test, patient):
    # Always-open override for today so the check depends only on the lead time.
    today = timezone.now().astimezone(local_tz()).date()
    SlotRule.objects.create(
        centre=centre_test.centre, date=today, start_time=time(0), end_time=time(23, 30), capacity=5
    )
    now_local = timezone.now().astimezone(local_tz())
    current = now_local.replace(
        minute=now_local.minute - now_local.minute % 30, second=0, microsecond=0
    )
    if current.time() >= time(23):
        pytest.skip("too close to midnight for a same-day slot")

    client.force_authenticate(user=patient)
    assert _book(client, centre_test, current + timedelta(minutes=30)).status_code == 400

    client.force_authenticate(user=_centre_user(centre_test.centre))
    assert _book(client, centre_test, current, patient=patient.id).status_code == 201
