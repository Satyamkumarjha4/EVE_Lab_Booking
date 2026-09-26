import pytest
from django.core.management import call_command

from catalog.models import Centre, CentreTest, Lab, Test


@pytest.mark.django_db
def test_seed_creates_substantial_data():
    call_command("seed_demo_data")

    assert Lab.objects.count() == 6
    assert Centre.objects.count() >= 15
    assert Test.objects.count() == 20
    assert CentreTest.objects.count() >= 150


@pytest.mark.django_db
def test_seed_is_idempotent():
    call_command("seed_demo_data")
    counts_after_first_run = (
        Lab.objects.count(),
        Centre.objects.count(),
        Test.objects.count(),
        CentreTest.objects.count(),
    )

    call_command("seed_demo_data")
    counts_after_second_run = (
        Lab.objects.count(),
        Centre.objects.count(),
        Test.objects.count(),
        CentreTest.objects.count(),
    )

    assert counts_after_first_run == counts_after_second_run
