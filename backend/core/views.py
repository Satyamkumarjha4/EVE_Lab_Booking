from django.conf import settings
from django.core.cache import cache
from django.db import connection
from django.http import Http404
from django.views.debug import default_urlconf
from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import HealthCheckSerializer


def root_view(request):
    """Root URL — Django's stock "it worked" page, same as a fresh un-configured project."""
    if not settings.DEBUG:
        raise Http404
    return default_urlconf(request)


class HealthCheckView(APIView):
    """Reports whether the API, database, and Redis are reachable."""

    authentication_classes = []
    permission_classes = []

    @extend_schema(
        summary="Health check",
        description="Reports service status plus database and Redis connectivity.",
        responses={200: HealthCheckSerializer, 503: HealthCheckSerializer},
    )
    def get(self, request):
        checks = {"database": self._check_database(), "redis": self._check_redis()}
        healthy = all(checks.values())
        payload = {"status": "ok" if healthy else "unavailable", "checks": checks}
        return Response(payload, status=200 if healthy else 503)

    @staticmethod
    def _check_database():
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            return True
        except Exception:
            return False

    @staticmethod
    def _check_redis():
        try:
            cache.set("health_check", "ok", timeout=5)
            return cache.get("health_check") == "ok"
        except Exception:
            return False
