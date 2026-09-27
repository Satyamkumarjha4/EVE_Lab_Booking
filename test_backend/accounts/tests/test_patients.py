import pytest
from rest_framework.test import APIClient

from accounts.models import User
from catalog.models import Centre, Lab

NEW_PATIENT = {
    "email": "Asha.Rao@Example.com",
    "first_name": "Asha",
    "last_name": "Rao",
    "phone": "+91 98765 43210",
    "date_of_birth": "1990-04-12",
    "gender": "FEMALE",
}


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def desk():
    lab = Lab.objects.create(name="Apollo", location="Delhi")
    centre = Centre.objects.create(lab=lab, name="Apollo - CP", location="CP")
    return User.objects.create_user(email="desk@example.com", role=User.Role.CENTRE, centre=centre)


@pytest.mark.django_db
def test_desk_finds_an_existing_patient_by_email(client, desk):
    patient = User.objects.create_user(
        email="p@example.com", first_name="Ravi", phone="99999 00000"
    )
    client.force_authenticate(user=desk)

    response = client.get("/patients/lookup/?email=P@Example.com")

    assert response.status_code == 200
    assert (response.data["id"], response.data["full_name"]) == (patient.id, "Ravi")


@pytest.mark.django_db
def test_lookup_misses_are_404_and_staff_are_never_returned(client, desk):
    client.force_authenticate(user=desk)

    miss = client.get("/patients/lookup/?email=nobody@example.com")
    assert miss.status_code == 404
    # The 404 must not leak the internal model name via Django's default message.
    assert "User" not in miss.data["detail"]
    assert client.get(f"/patients/lookup/?email={desk.email}").status_code == 404
    assert client.get("/patients/lookup/").status_code == 400


@pytest.mark.django_db
def test_desk_finds_a_patient_with_no_prior_relationship_to_their_centre(client):
    """Platform-wide lookup is intentional: a walk-in must be findable at any centre/lab,
    not just one they've visited before. This locks that behavior in as by-design."""
    lab = Lab.objects.create(name="Fortis", location="Mumbai")
    centre = Centre.objects.create(lab=lab, name="Fortis - Andheri", location="Andheri")
    unrelated_desk = User.objects.create_user(
        email="fortis-desk@example.com", role=User.Role.CENTRE, centre=centre
    )
    patient = User.objects.create_user(email="p@example.com", first_name="Ravi")
    client.force_authenticate(user=unrelated_desk)

    response = client.get("/patients/lookup/?email=p@example.com")

    assert response.status_code == 200
    assert response.data["id"] == patient.id


@pytest.mark.django_db
def test_patient_lookup_is_rate_limited_tighter_than_default(client, desk):
    client.force_authenticate(user=desk)

    for _ in range(20):
        response = client.get("/patients/lookup/?email=nobody@example.com")
        assert response.status_code == 404

    throttled = client.get("/patients/lookup/?email=nobody@example.com")

    assert throttled.status_code == 429


@pytest.mark.django_db
def test_desk_registers_a_new_patient_without_a_password(client, desk):
    client.force_authenticate(user=desk)

    response = client.post("/patients/", NEW_PATIENT)

    assert response.status_code == 201
    patient = User.objects.get(pk=response.data["id"])
    assert patient.email == "asha.rao@example.com"
    assert patient.role == User.Role.CLIENT
    assert not patient.has_usable_password()
    assert (patient.full_name, str(patient.date_of_birth)) == ("Asha Rao", "1990-04-12")


@pytest.mark.django_db
def test_registering_an_existing_email_is_rejected(client, desk):
    User.objects.create_user(email="asha.rao@example.com")
    client.force_authenticate(user=desk)

    response = client.post("/patients/", NEW_PATIENT)

    assert response.status_code == 400
    assert "email" in response.data


@pytest.mark.django_db
@pytest.mark.parametrize(
    "field,value", [("phone", "call me"), ("gender", "X"), ("date_of_birth", "2999-01-01")]
)
def test_patient_details_are_validated(client, desk, field, value):
    client.force_authenticate(user=desk)

    assert client.post("/patients/", {**NEW_PATIENT, field: value}).status_code == 400


@pytest.mark.django_db
def test_patients_cannot_look_up_or_register_others(client):
    client.force_authenticate(user=User.objects.create_user(email="p@example.com"))

    assert client.get("/patients/lookup/?email=p@example.com").status_code == 403
    assert client.post("/patients/", NEW_PATIENT).status_code == 403
