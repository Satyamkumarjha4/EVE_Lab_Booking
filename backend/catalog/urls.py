from django.urls import path

from .views import CentreListView, CentreTestListView

urlpatterns = [
    path("", CentreListView.as_view(), name="centre-list"),
    path("<int:pk>/tests/", CentreTestListView.as_view(), name="centre-tests"),
]
