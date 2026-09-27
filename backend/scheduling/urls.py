from django.urls import path

from .views import SlotAvailabilityView, SlotRuleDetailView, SlotRuleListCreateView

# Mounted under /centres/ alongside the catalog routes.
urlpatterns = [
    path("<int:centre_pk>/slots/", SlotAvailabilityView.as_view(), name="centre-slots"),
    path("<int:centre_pk>/slot-rules/", SlotRuleListCreateView.as_view(), name="slot-rules"),
    path(
        "<int:centre_pk>/slot-rules/<int:pk>/",
        SlotRuleDetailView.as_view(),
        name="slot-rule-detail",
    ),
]
