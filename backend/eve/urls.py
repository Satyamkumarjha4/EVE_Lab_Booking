from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from catalog.views import CatalogTestListView
from core.views import root_view

urlpatterns = [
    path("", root_view, name="root"),
    path("admin/", admin.site.urls),
    path("auth/", include("accounts.urls")),
    path("centres/", include("catalog.urls")),
    path("centres/", include("scheduling.urls")),
    path("tests/", CatalogTestListView.as_view(), name="test-list"),
    path("bookings/", include("bookings.urls")),
    path("patients/", include("accounts.patient_urls")),
    path("payments/", include("payments.urls")),
    path("api/health/", include("core.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/schema/swagger-ui/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
]
