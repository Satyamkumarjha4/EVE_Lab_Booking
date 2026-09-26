import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from catalog.models import Centre, CentreTest, Lab, Test


@pytest.fixture
def client():
    return APIClient()


@pytest.mark.django_db
def test_centre_list_is_served_from_cache_on_second_call(client):
    lab = Lab.objects.create(name="Apollo Diagnostics", location="Delhi")
    Centre.objects.create(lab=lab, name="Apollo - CP", location="Connaught Place")

    first = client.get("/centres/")
    assert first.status_code == 200
    assert len(first.data) == 1
    assert cache.get("centres:list:all") is not None

    Centre.objects.filter(name="Apollo - CP").update(name="renamed-without-invalidation")
    second = client.get("/centres/")

    assert second.data == first.data


@pytest.mark.django_db
def test_centre_write_invalidates_list_cache(client):
    lab = Lab.objects.create(name="Apollo Diagnostics", location="Delhi")
    Centre.objects.create(lab=lab, name="Apollo - CP", location="Connaught Place")
    client.get("/centres/")
    assert cache.get("centres:list:all") is not None

    Centre.objects.create(lab=lab, name="Apollo - Dwarka", location="Dwarka")

    assert cache.get("centres:list:all") is None
    response = client.get("/centres/")
    assert len(response.data) == 2


@pytest.mark.django_db
def test_stale_data_cached_during_an_open_write_is_cleared_on_commit(
    django_capture_on_commit_callbacks,
):
    lab = Lab.objects.create(name="Apollo Diagnostics", location="Delhi")

    with django_capture_on_commit_callbacks(execute=True):
        Centre.objects.create(lab=lab, name="Apollo - CP", location="Connaught Place")
        # A concurrent reader that queried before the commit re-caches the old list.
        cache.set("centres:list:all", [], 60)

    assert cache.get("centres:list:all") is None


@pytest.mark.django_db
def test_lab_rename_invalidates_centre_list_cache(client):
    lab = Lab.objects.create(name="Apollo Diagnostics", location="Delhi")
    Centre.objects.create(lab=lab, name="Apollo - CP", location="Connaught Place")
    client.get("/centres/")

    lab.name = "Apollo Labs"
    lab.save()

    assert client.get("/centres/").data[0]["lab"]["name"] == "Apollo Labs"


@pytest.mark.django_db
def test_centre_test_write_invalidates_tests_cache(client):
    lab = Lab.objects.create(name="Apollo Diagnostics", location="Delhi")
    centre = Centre.objects.create(lab=lab, name="Apollo - CP", location="Connaught Place")
    test = Test.objects.create(name="CBC", description="Complete blood count")
    CentreTest.objects.create(centre=centre, test=test, price="350.00")

    client.get(f"/centres/{centre.id}/tests/")
    assert cache.get(f"centres:{centre.id}:tests") is not None

    another_test = Test.objects.create(name="Lipid Profile", description="Cholesterol panel")
    CentreTest.objects.create(centre=centre, test=another_test, price="600.00")

    assert cache.get(f"centres:{centre.id}:tests") is None
    response = client.get(f"/centres/{centre.id}/tests/")
    assert len(response.data) == 2
