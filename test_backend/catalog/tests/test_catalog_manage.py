from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from accounts.models import User
from catalog.models import Centre, CentreTest, Lab, Test


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def catalog():
    apollo = Lab.objects.create(name="Apollo Diagnostics", location="Delhi")
    metro = Lab.objects.create(name="Metro Health Labs", location="Mumbai")
    apollo_cp = Centre.objects.create(lab=apollo, name="Apollo - CP", location="Connaught Place")
    metro_andheri = Centre.objects.create(lab=metro, name="Metro - Andheri", location="Andheri")
    cbc = Test.objects.create(name="CBC", description="Complete blood count")
    lipid = Test.objects.create(name="Lipid Profile", description="Cholesterol panel")
    cbc_at_cp = CentreTest.objects.create(centre=apollo_cp, test=cbc, price="350.00")
    return {
        "apollo": apollo,
        "apollo_cp": apollo_cp,
        "metro_andheri": metro_andheri,
        "cbc": cbc,
        "lipid": lipid,
        "cbc_at_cp": cbc_at_cp,
    }


def _user(role, **extra):
    return User.objects.create_user(
        email=f"{role.lower()}-{len(extra)}@example.com",
        password="a-strong-passw0rd",
        role=role,
        **extra,
    )


@pytest.mark.django_db
def test_lab_creates_centre_under_its_own_lab(client, catalog):
    client.force_authenticate(user=_user(User.Role.LAB, lab=catalog["apollo"]))

    response = client.post("/centres/", {"name": "Apollo - Saket", "location": "Saket", "lab": 999})

    assert response.status_code == 201
    assert response.data["lab"]["id"] == catalog["apollo"].id
    assert client.get("/centres/").data[-1]["name"] == "Apollo - Saket"


@pytest.mark.django_db
@pytest.mark.parametrize("role", [User.Role.CLIENT, User.Role.CENTRE])
def test_non_lab_roles_cannot_create_centres(client, catalog, role):
    extra = {"centre": catalog["apollo_cp"]} if role == User.Role.CENTRE else {}
    client.force_authenticate(user=_user(role, **extra))

    response = client.post("/centres/", {"name": "X", "location": "Y"})

    assert response.status_code == 403


@pytest.mark.django_db
def test_anonymous_cannot_create_centres(client, catalog):
    response = client.post("/centres/", {"name": "X", "location": "Y"})

    assert response.status_code == 401


@pytest.mark.django_db
def test_lab_updates_own_centre_but_not_another_labs(client, catalog):
    client.force_authenticate(user=_user(User.Role.LAB, lab=catalog["apollo"]))

    own = client.patch(f"/centres/{catalog['apollo_cp'].id}/", {"location": "CP Block A"})
    other = client.patch(f"/centres/{catalog['metro_andheri'].id}/", {"location": "Hijacked"})

    assert own.status_code == 200
    assert own.data["location"] == "CP Block A"
    assert other.status_code == 403
    catalog["metro_andheri"].refresh_from_db()
    assert catalog["metro_andheri"].location == "Andheri"


@pytest.mark.django_db
def test_lab_offers_a_test_at_its_centre_with_its_own_price(client, catalog):
    client.force_authenticate(user=_user(User.Role.LAB, lab=catalog["apollo"]))

    response = client.post(
        f"/centres/{catalog['apollo_cp'].id}/tests/",
        {"test": catalog["lipid"].id, "price": "649.00"},
    )

    assert response.status_code == 201
    assert response.data["test"]["name"] == "Lipid Profile"
    assert response.data["price"] == "649.00"
    public = client.get(f"/centres/{catalog['apollo_cp'].id}/tests/")
    assert {row["test"]["name"] for row in public.data} == {"CBC", "Lipid Profile"}


@pytest.mark.django_db
def test_offering_the_same_test_twice_is_rejected(client, catalog):
    client.force_authenticate(user=_user(User.Role.LAB, lab=catalog["apollo"]))

    response = client.post(
        f"/centres/{catalog['apollo_cp'].id}/tests/", {"test": catalog["cbc"].id, "price": "1.00"}
    )

    assert response.status_code == 400
    assert "test" in response.data


@pytest.mark.django_db
@pytest.mark.parametrize("price", ["0", "-10.00"])
def test_non_positive_price_is_rejected(client, catalog, price):
    client.force_authenticate(user=_user(User.Role.LAB, lab=catalog["apollo"]))

    response = client.post(
        f"/centres/{catalog['apollo_cp'].id}/tests/", {"test": catalog["lipid"].id, "price": price}
    )

    assert response.status_code == 400
    assert "price" in response.data


@pytest.mark.django_db
def test_lab_cannot_manage_tests_at_another_labs_centre(client, catalog):
    client.force_authenticate(user=_user(User.Role.LAB, lab=catalog["apollo"]))

    response = client.post(
        f"/centres/{catalog['metro_andheri'].id}/tests/",
        {"test": catalog["cbc"].id, "price": "100.00"},
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_centre_cannot_add_tests_even_at_its_own_centre(client, catalog):
    client.force_authenticate(user=_user(User.Role.CENTRE, centre=catalog["apollo_cp"]))

    own = client.post(
        f"/centres/{catalog['apollo_cp'].id}/tests/",
        {"test": catalog["lipid"].id, "price": "600.00"},
    )
    other = client.post(
        f"/centres/{catalog['metro_andheri'].id}/tests/",
        {"test": catalog["lipid"].id, "price": "600.00"},
    )

    assert own.status_code == 403
    assert other.status_code == 404


@pytest.mark.django_db
def test_centre_toggles_availability_but_cannot_change_price(client, catalog):
    client.force_authenticate(user=_user(User.Role.CENTRE, centre=catalog["apollo_cp"]))
    url = f"/centres/{catalog['apollo_cp'].id}/tests/{catalog['cbc_at_cp'].id}/"

    price_change = client.patch(url, {"price": "1.00"})
    availability = client.patch(url, {"is_active": False})

    assert price_change.status_code == 403
    assert availability.status_code == 200
    catalog["cbc_at_cp"].refresh_from_db()
    assert catalog["cbc_at_cp"].price == Decimal("350.00")
    assert catalog["cbc_at_cp"].is_active is False


@pytest.mark.django_db
def test_centre_cannot_edit_its_centre_details(client, catalog):
    client.force_authenticate(user=_user(User.Role.CENTRE, centre=catalog["apollo_cp"]))

    response = client.patch(f"/centres/{catalog['apollo_cp'].id}/", {"name": "Renamed"})

    assert response.status_code == 403


@pytest.mark.django_db
def test_new_centre_gets_the_default_slot_schedule(client, catalog):
    client.force_authenticate(user=_user(User.Role.LAB, lab=catalog["apollo"]))

    response = client.post("/centres/", {"name": "Apollo - Saket", "location": "Saket, Delhi"})

    assert response.status_code == 201
    centre = Centre.objects.get(pk=response.data["id"])
    assert centre.slot_rules.filter(weekday__isnull=False).count() == 7


@pytest.mark.django_db
def test_client_cannot_manage_centre_tests(client, catalog):
    client.force_authenticate(user=_user(User.Role.CLIENT))

    response = client.patch(
        f"/centres/{catalog['apollo_cp'].id}/tests/{catalog['cbc_at_cp'].id}/", {"price": "1.00"}
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_lab_updates_price_of_a_test_at_its_centre(client, catalog):
    client.force_authenticate(user=_user(User.Role.LAB, lab=catalog["apollo"]))

    response = client.patch(
        f"/centres/{catalog['apollo_cp'].id}/tests/{catalog['cbc_at_cp'].id}/",
        {"price": "399.00"},
    )

    assert response.status_code == 200
    assert response.data["price"] == "399.00"
    assert response.data["test"]["name"] == "CBC"


@pytest.mark.django_db
def test_centre_test_must_belong_to_the_centre_in_the_url(client, catalog):
    client.force_authenticate(user=_user(User.Role.LAB, lab=catalog["apollo"]))

    response = client.patch(
        f"/centres/{catalog['metro_andheri'].id}/tests/{catalog['cbc_at_cp'].id}/",
        {"price": "1.00"},
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_deactivated_test_is_hidden_publicly_but_visible_to_managers(client, catalog):
    lab_user = _user(User.Role.LAB, lab=catalog["apollo"])
    client.force_authenticate(user=lab_user)
    client.patch(
        f"/centres/{catalog['apollo_cp'].id}/tests/{catalog['cbc_at_cp'].id}/",
        {"is_active": False},
    )
    url = f"/centres/{catalog['apollo_cp'].id}/tests/?include_inactive=true"

    managers_view = client.get(url)
    client.force_authenticate(user=None)
    public_view = client.get(url)

    assert [row["is_active"] for row in managers_view.data] == [False]
    assert public_view.data == []


@pytest.mark.django_db
def test_global_test_catalog_is_listed(client, catalog):
    response = client.get("/tests/")

    assert response.status_code == 200
    assert [row["name"] for row in response.data] == ["CBC", "Lipid Profile"]
