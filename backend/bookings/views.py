from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from core.serializers import DetailSerializer

from .models import Booking
from .serializers import BookingCreateSerializer, BookingSerializer
from .services import cancel_booking


def _bookings_for(user):
    return (
        Booking.objects.for_user(user)
        .select_related("client", "centre_test__centre__lab", "centre_test__test")
        .order_by("-created_at")
    )


@extend_schema(
    summary="List / create bookings",
    description="Role-scoped booking list. Clients (self) and Centres (own) can create bookings.",
)
class BookingListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = "default"

    def get_serializer_class(self):
        return BookingCreateSerializer if self.request.method == "POST" else BookingSerializer

    def get_queryset(self):
        return _bookings_for(self.request.user)

    def perform_create(self, serializer):
        user = self.request.user
        if user.role not in (User.Role.CLIENT, User.Role.CENTRE):
            raise PermissionDenied("Only clients or centres can create bookings.")
        if user.role == User.Role.CENTRE:
            centre_test = serializer.validated_data["centre_test"]
            if centre_test.centre_id != user.centre_id:
                raise PermissionDenied("Centres can only book their own tests.")
        serializer.save()


@extend_schema(summary="Retrieve a booking", description="Role-scoped booking detail.")
class BookingDetailView(generics.RetrieveAPIView):
    serializer_class = BookingSerializer
    permission_classes = [IsAuthenticated]
    throttle_scope = "default"

    def get_queryset(self):
        return _bookings_for(self.request.user)


@extend_schema(
    summary="Cancel a booking",
    description=(
        "Only the owning Client or the owning Lab (of the centre) can cancel. PENDING and "
        "CONFIRMED bookings can be cancelled; cancelling a paid booking flags a simulated refund."
    ),
    request=None,
    responses={
        200: BookingSerializer,
        403: DetailSerializer,
        404: DetailSerializer,
        409: DetailSerializer,
    },
)
class BookingCancelView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = "default"

    def post(self, request, pk):
        user = request.user
        if user.role not in (User.Role.CLIENT, User.Role.LAB):
            raise PermissionDenied("Only the client or the lab can cancel a booking.")

        booking = get_object_or_404(Booking.objects.for_user(user), pk=pk)
        cancelled = cancel_booking(booking)
        if cancelled is None:
            return Response(
                {"detail": "Booking cannot be cancelled from its current state."},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(BookingSerializer(_bookings_for(user).get(pk=cancelled.pk)).data)
