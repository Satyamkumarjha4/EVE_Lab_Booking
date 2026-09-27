from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from bookings.models import Booking
from catalog.models import Centre, CentreTest, Lab, Test


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def setup():
    lab = Lab.objects.create(name="Apollo Diagnostics", location="Delhi")
    centre = Centre.objects.create(lab=lab, name="Apollo - CP", location="Connaught Place")
    other_centre = Centre.objects.create(lab=lab, name="Apollo - Dwarka", location="Dwarka")
    test = Test.objects.create(name="CBC")
    centre_test = CentreTest.objects.create(centre=centre, test=test, price="350.00")
    patient = User.objects.create_user(email="p@example.com", password="a-strong-passw0rd")
    booking = Booking.objects.create(
        client=patient,
        centre_test=centre_test,
        appointment_at=timezone.now() - timedelta(minutes=10),
        amount=350,
        status=Booking.Status.CONFIRMED,
    )
    users = {
        "patient": patient,
        "centre": User.objects.create_user(
            email="c@example.com", password="x", role=User.Role.CENTRE, centre=centre
        ),
        "other_centre": User.objects.create_user(
            email="c2@example.com", password="x", role=User.Role.CENTRE, centre=other_centre
        ),
        "lab": User.objects.create_user(
            email="l@example.com", password="x", role=User.Role.LAB, lab=lab
        ),
    }
    return booking, users


@pytest.mark.django_db
@pytest.mark.parametrize("role", ["centre", "lab"])
def test_centre_or_lab_completes_then_delivers_the_report(client, setup, role):
    booking, users = setup
    client.force_authenticate(user=users[role])

    completed = client.post(f"/bookings/{booking.id}/complete/")
    delivered = client.post(f"/bookings/{booking.id}/deliver-report/")

    assert completed.status_code == 200
    assert completed.data["status"] == Booking.Status.COMPLETED
    assert delivered.status_code == 200
    assert delivered.data["status"] == Booking.Status.REPORT_DELIVERED
    history = [(e["status"], e["actor_role"]) for e in delivered.data["events"]]
    assert history[-2:] == [("COMPLETED", role.upper()), ("REPORT_DELIVERED", role.upper())]


@pytest.mark.django_db
def test_patient_cannot_mark_their_own_test_completed(client, setup):
    booking, users = setup
    client.force_authenticate(user=users["patient"])

    assert client.post(f"/bookings/{booking.id}/complete/").status_code == 403


@pytest.mark.django_db
def test_another_centre_cannot_complete_the_booking(client, setup):
    booking, users = setup
    client.force_authenticate(user=users["other_centre"])

    assert client.post(f"/bookings/{booking.id}/complete/").status_code == 404


@pytest.mark.django_db
@pytest.mark.parametrize(
    "status",
    [
        Booking.Status.PENDING,
        Booking.Status.FAILED,
        Booking.Status.CANCELLED,
        Booking.Status.NO_SHOW,
    ],
)
def test_only_confirmed_bookings_can_be_completed(client, setup, status):
    booking, users = setup
    Booking.objects.filter(pk=booking.pk).update(status=status)
    client.force_authenticate(user=users["centre"])

    assert client.post(f"/bookings/{booking.id}/complete/").status_code == 409


@pytest.mark.django_db
def test_cannot_complete_before_the_appointment_day(client, setup):
    booking, users = setup
    Booking.objects.filter(pk=booking.pk).update(appointment_at=timezone.now() + timedelta(days=3))
    client.force_authenticate(user=users["centre"])

    assert client.post(f"/bookings/{booking.id}/complete/").status_code == 409


@pytest.mark.django_db
def test_report_needs_a_completed_test(client, setup):
    booking, users = setup
    client.force_authenticate(user=users["centre"])

    assert client.post(f"/bookings/{booking.id}/deliver-report/").status_code == 409
