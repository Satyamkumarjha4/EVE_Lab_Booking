from datetime import timedelta

import pytest
from rest_framework.test import APIClient

from accounts.models import User
from catalog.models import Centre, Lab
from scheduling.models import SlotRule
from scheduling.services import create_default_schedule, local_today


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def centres():
    apollo = Lab.objects.create(name="Apollo", location="Delhi")
    metro = Lab.objects.create(name="Metro", location="Mumbai")
    cp = Centre.objects.create(lab=apollo, name="Apollo - CP", location="CP, Delhi")
    andheri = Centre.objects.create(lab=metro, name="Metro - Andheri", location="Andheri, Mumbai")
    for centre in (cp, andheri):
        create_default_schedule(centre)
    return {"apollo": apollo, "cp": cp, "andheri": andheri}


def _staff(centres):
    return User.objects.create_user(
        email="c@example.com", role=User.Role.CENTRE, centre=centres["cp"]
    )


def _rules_url(centre):
    return f"/centres/{centre.id}/slot-rules/"


def _override(**overrides):
    body = {
        "date": (local_today() + timedelta(days=3)).isoformat(),
        "start_time": "10:00",
        "end_time": "12:00",
        "capacity": 5,
    }
    return {**body, **overrides}


@pytest.mark.django_db
def test_centre_staff_add_edit_and_delete_their_rules(client, centres):
    client.force_authenticate(user=_staff(centres))

    created = client.post(_rules_url(centres["cp"]), _override(), format="json")
    rule_url = f"{_rules_url(centres['cp'])}{created.data['id']}/"
    edited = client.patch(rule_url, {"capacity": 8}, format="json")
    deleted = client.delete(rule_url)

    assert created.status_code == 201
    assert edited.status_code == 200 and edited.data["capacity"] == 8
    assert deleted.status_code == 204
    assert not SlotRule.objects.filter(date__isnull=False).exists()


@pytest.mark.django_db
def test_lab_can_read_but_not_change_its_centres_rules(client, centres):
    client.force_authenticate(
        user=User.objects.create_user(
            email="l@example.com", role=User.Role.LAB, lab=centres["apollo"]
        )
    )

    listed = client.get(_rules_url(centres["cp"]))
    created = client.post(_rules_url(centres["cp"]), _override(), format="json")

    assert listed.status_code == 200 and len(listed.data) == 7
    assert created.status_code == 403


@pytest.mark.django_db
def test_other_centres_and_clients_cannot_see_rules(client, centres):
    client.force_authenticate(user=_staff(centres))
    assert client.get(_rules_url(centres["andheri"])).status_code == 404

    client.force_authenticate(user=User.objects.create_user(email="p@example.com"))
    assert client.get(_rules_url(centres["cp"])).status_code == 404


@pytest.mark.django_db
@pytest.mark.parametrize(
    "body",
    [
        _override(start_time="10:15"),  # not on a 30-minute boundary
        _override(end_time="09:00"),  # ends before it starts
        _override(capacity=51),
        _override(date=(local_today() - timedelta(days=1)).isoformat()),
        {**_override(), "weekday": 2},  # both weekday and date
        {k: v for k, v in _override().items() if k != "date"},  # neither
    ],
)
def test_invalid_rules_are_rejected(client, centres, body):
    client.force_authenticate(user=_staff(centres))

    assert client.post(_rules_url(centres["cp"]), body, format="json").status_code == 400


@pytest.mark.django_db
def test_rules_on_the_same_day_cannot_overlap(client, centres):
    client.force_authenticate(user=_staff(centres))
    client.post(_rules_url(centres["cp"]), _override(), format="json")

    overlapping = client.post(
        _rules_url(centres["cp"]), _override(start_time="11:30", end_time="14:00"), format="json"
    )
    adjacent = client.post(
        _rules_url(centres["cp"]), _override(start_time="12:00", end_time="14:00"), format="json"
    )
    weekly_overlap = client.post(
        _rules_url(centres["cp"]),
        {"weekday": 0, "start_time": "08:00", "end_time": "09:00", "capacity": 2},
        format="json",
    )

    assert overlapping.status_code == 400
    assert adjacent.status_code == 201
    assert weekly_overlap.status_code == 400  # the default Monday rule covers 07:00–19:00
