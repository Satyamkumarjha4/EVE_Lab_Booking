from django.test import override_settings
from rest_framework.test import APIClient


@override_settings(DEBUG=True)
def test_root_shows_default_django_page():
    client = APIClient()
    response = client.get("/")

    assert response.status_code == 200
    assert b"The install worked successfully" in response.content


@override_settings(DEBUG=False)
def test_root_returns_404_when_debug_is_off():
    client = APIClient()
    response = client.get("/")

    assert response.status_code == 404
