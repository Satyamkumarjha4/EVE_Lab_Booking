from django.urls import path

from .views import (
    BookingCancelView,
    BookingCompleteView,
    BookingDeliverReportView,
    BookingDetailView,
    BookingListCreateView,
)

urlpatterns = [
    path("", BookingListCreateView.as_view(), name="booking-list-create"),
    path("<int:pk>/", BookingDetailView.as_view(), name="booking-detail"),
    path("<int:pk>/cancel/", BookingCancelView.as_view(), name="booking-cancel"),
    path("<int:pk>/complete/", BookingCompleteView.as_view(), name="booking-complete"),
    path(
        "<int:pk>/deliver-report/",
        BookingDeliverReportView.as_view(),
        name="booking-deliver-report",
    ),
]
