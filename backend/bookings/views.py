from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from core.serializers import DetailSerializer
from scheduling.services import SlotUnavailable

from .models import Booking
from .serializers import BookingCreateSerializer, BookingSerializer, CancelBookingSerializer
from .services import (
    TransitionNotAllowed,
    cancel_booking,
    complete_booking,
    create_booking,
    deliver_report,
)


def _bookings_for(user):
    return (
        Booking.objects.for_user(user)
        .select_related("client", "centre_test__centre__lab", "centre_test__test", "payment")
        .prefetch_related("events")
        .order_by("-created_at")
    )


def _conflict(detail):
    return Response({"detail": detail}, status=status.HTTP_409_CONFLICT)


@extend_schema(
    summary="List / create bookings",
    description=(
        "Role-scoped booking list. Clients book for themselves; centre staff book walk-ins at "
        "their own centre and must pass `patient` (see /patients/). `appointment_at` must be a "
        "free 30-minute slot (GET /centres/{id}/slots/): 400 if it's misaligned, closed or too "
        "soon, 409 if the slot is full."
    ),
    responses={201: BookingSerializer, 400: DetailSerializer, 409: DetailSerializer},
)
class BookingListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = "default"

    def get_serializer_class(self):
        return BookingCreateSerializer if self.request.method == "POST" else BookingSerializer

    def get_queryset(self):
        return _bookings_for(self.request.user)

    def create(self, request, *args, **kwargs):
        user = request.user
        if user.role not in (User.Role.CLIENT, User.Role.CENTRE):
            raise PermissionDenied("Only clients or centres can create bookings.")
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if user.role == User.Role.CENTRE and data["centre_test"].centre_id != user.centre_id:
            raise PermissionDenied("Centres can only book their own tests.")

        try:
            booking = create_booking(
                centre_test=data["centre_test"],
                appointment_at=data["appointment_at"],
                client=user if user.role == User.Role.CLIENT else data["patient"],
                actor=user,
            )
        except SlotUnavailable as exc:
            if exc.code == "full":
                return _conflict(exc.message)
            return Response({"appointment_at": [exc.message]}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            BookingSerializer(_bookings_for(user).get(pk=booking.pk)).data,
            status=status.HTTP_201_CREATED,
        )


@extend_schema(summary="Retrieve a booking", description="Role-scoped booking detail.")
class BookingDetailView(generics.RetrieveAPIView):
    serializer_class = BookingSerializer
    permission_classes = [IsAuthenticated]
    throttle_scope = "default"

    def get_queryset(self):
        return _bookings_for(self.request.user)


class _TransitionView(APIView):
    """POST-only state change on one booking, by one of `allowed_roles`."""

    permission_classes = [IsAuthenticated]
    throttle_scope = "default"
    allowed_roles = ()
    role_error = ""

    def transition(self, booking, request):
        raise NotImplementedError

    def post(self, request, pk):
        user = request.user
        if user.role not in self.allowed_roles:
            raise PermissionDenied(self.role_error)
        booking = get_object_or_404(Booking.objects.for_user(user), pk=pk)
        try:
            updated = self.transition(booking, request)
        except TransitionNotAllowed as exc:
            return _conflict(exc.message)
        return Response(BookingSerializer(_bookings_for(user).get(pk=updated.pk)).data)


_TRANSITION_RESPONSES = {
    200: BookingSerializer,
    403: DetailSerializer,
    404: DetailSerializer,
    409: DetailSerializer,
}


@extend_schema(
    summary="Cancel a booking",
    description=(
        "Only the owning Client or the owning Lab (of the centre) can cancel, and only before the "
        "appointment. A reason is required and is kept in the booking's history. A paid booking "
        "is refunded: in full when the lab cancels, minus the lab's transaction fee when the "
        "patient does."
    ),
    request=CancelBookingSerializer,
    responses=_TRANSITION_RESPONSES,
)
class BookingCancelView(_TransitionView):
    allowed_roles = (User.Role.CLIENT, User.Role.LAB)
    role_error = "Only the client or the lab can cancel a booking."

    def transition(self, booking, request):
        serializer = CancelBookingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return cancel_booking(booking, request.user, serializer.validated_data["reason"])


@extend_schema(
    summary="Mark a test as completed",
    description=(
        "Centre staff (own centre) or the lab: the patient came in and the sample was taken. "
        "CONFIRMED → COMPLETED, from the appointment's day on. Confirmed bookings nobody marks "
        "become NO_SHOW automatically after the appointment plus a grace period."
    ),
    request=None,
    responses=_TRANSITION_RESPONSES,
)
class BookingCompleteView(_TransitionView):
    allowed_roles = (User.Role.CENTRE, User.Role.LAB)
    role_error = "Only the centre or the lab can complete a booking."

    def transition(self, booking, request):
        return complete_booking(booking, request.user)


@extend_schema(
    summary="Mark a report as delivered",
    description="Centre staff (own centre) or the lab: COMPLETED → REPORT_DELIVERED.",
    request=None,
    responses=_TRANSITION_RESPONSES,
)
class BookingDeliverReportView(_TransitionView):
    allowed_roles = (User.Role.CENTRE, User.Role.LAB)
    role_error = "Only the centre or the lab can deliver a report."

    def transition(self, booking, request):
        return deliver_report(booking, request.user)
