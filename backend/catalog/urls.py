from django.urls import path

from .views import (
    CentreListCreateView,
    CentreTestListCreateView,
    CentreTestUpdateView,
    CentreUpdateView,
)

urlpatterns = [
    path("", CentreListCreateView.as_view(), name="centre-list"),
    path("<int:pk>/", CentreUpdateView.as_view(), name="centre-detail"),
    path("<int:centre_pk>/tests/", CentreTestListCreateView.as_view(), name="centre-tests"),
    path(
        "<int:centre_pk>/tests/<int:pk>/",
        CentreTestUpdateView.as_view(),
        name="centre-test-detail",
    ),
]
