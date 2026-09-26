import pytest
from django.core.management import call_command


@pytest.mark.django_db
def test_openapi_schema_generates_without_warnings(tmp_path):
    """Keeps Swagger in sync: any view/serializer change that breaks the schema fails here."""
    call_command("spectacular", "--fail-on-warn", "--file", str(tmp_path / "schema.yaml"))
