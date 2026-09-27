from django.urls import path

from .patient_views import PatientCreateView, PatientLookupView

urlpatterns = [
    path("", PatientCreateView.as_view(), name="patient-create"),
    path("lookup/", PatientLookupView.as_view(), name="patient-lookup"),
]
