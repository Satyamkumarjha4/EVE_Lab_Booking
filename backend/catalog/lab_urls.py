from django.urls import path

from .lab_views import LabMineView

urlpatterns = [
    path("mine/", LabMineView.as_view(), name="lab-mine"),
]
