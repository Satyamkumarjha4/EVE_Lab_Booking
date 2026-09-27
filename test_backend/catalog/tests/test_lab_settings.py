from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from accounts.models import User
from catalog.models import Centre, Lab


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def lab():
    return Lab.objects.create(name="Apollo", location="Delhi")


@pytest.mark.django_db
def test_lab_reads_and_updates_its_fee(client, lab):
    client.force_authenticate(
        user=User.objects.create_user(email="l@example.com", role=User.Role.LAB, lab=lab)
    )

    current = client.get("/labs/mine/")
    updated = client.patch("/labs/mine/", {"transaction_fee_percent": "7.50"})

    assert current.data["transaction_fee_percent"] == "5.00"
    assert updated.status_code == 200
    lab.refresh_from_db()
    assert lab.transaction_fee_percent == Decimal("7.50")


@pytest.mark.django_db
@pytest.mark.parametrize("fee", ["-1", "100.01"])
def test_fee_must_be_a_percentage(client, lab, fee):
    client.force_authenticate(
        user=User.objects.create_user(email="l@example.com", role=User.Role.LAB, lab=lab)
    )

    assert client.patch("/labs/mine/", {"transaction_fee_percent": fee}).status_code == 400


@pytest.mark.django_db
def test_only_lab_accounts_have_lab_settings(client, lab):
    centre = Centre.objects.create(lab=lab, name="Apollo - CP", location="CP")
    client.force_authenticate(
        user=User.objects.create_user(email="c@example.com", role=User.Role.CENTRE, centre=centre)
    )

    assert client.get("/labs/mine/").status_code == 403


@pytest.mark.django_db
def test_fee_is_public_on_centres_so_patients_see_it_before_cancelling(client, lab):
    Centre.objects.create(lab=lab, name="Apollo - CP", location="CP")

    response = client.get("/centres/")

    assert response.data[0]["lab"]["transaction_fee_percent"] == "5.00"
