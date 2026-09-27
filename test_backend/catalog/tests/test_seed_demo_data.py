import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from accounts.models import User
from catalog.management.commands.seed_demo_data import DEMO_PASSWORD
from catalog.models import Centre, CentreTest, Lab, Test


def _counts():
    return (
        Lab.objects.count(),
        Centre.objects.count(),
        Test.objects.count(),
        CentreTest.objects.count(),
        User.objects.count(),
    )


@pytest.mark.django_db
def test_seed_creates_substantial_data():
    call_command("seed_demo_data")

    assert Lab.objects.count() == 6
    assert Centre.objects.count() >= 15
    assert Test.objects.count() == 20
    assert CentreTest.objects.count() >= 150


@pytest.mark.django_db
def test_seed_creates_demo_logins_with_correct_affiliations():
    call_command("seed_demo_data")

    lab_user = User.objects.get(email="lab@demo.eve")
    centre_user = User.objects.get(email="centre@demo.eve")
    client_user = User.objects.get(email="client@demo.eve")
    assert lab_user.role == User.Role.LAB and lab_user.lab is not None
    assert centre_user.role == User.Role.CENTRE
    assert centre_user.centre.lab_id == lab_user.lab_id
    assert client_user.role == User.Role.CLIENT and client_user.lab is None

    response = APIClient().post(
        "/auth/login/", {"email": "lab@demo.eve", "password": DEMO_PASSWORD}
    )
    assert response.status_code == 200


@pytest.mark.django_db
def test_seed_is_idempotent():
    call_command("seed_demo_data")
    counts_after_first_run = _counts()

    call_command("seed_demo_data")

    assert _counts() == counts_after_first_run
