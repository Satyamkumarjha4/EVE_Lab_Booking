from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User

from .models import Booking
from .serializers import BookingCreateSerializer, BookingSerializer


@extend_schema(
    summary="List / create bookings",
    description="Role-scoped booking list. Clients (self) and Centres (own) can create bookings.",
)
class BookingListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        return BookingCreateSerializer if self.request.method == "POST" else BookingSerializer

    def get_queryset(self):
        return (
            Booking.objects.for_user(self.request.user)
            .select_related("client", "centre_test__centre__lab", "centre_test__test")
        )

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

    def get_queryset(self):
        return Booking.objects.for_user(self.request.user).select_related(
            "client", "centre_test__centre__lab", "centre_test__test"
        )


@extend_schema(
    summary="Cancel a booking",
    description="Only the owning Client or the owning Lab (of the centre) can cancel.",
)
class BookingCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        if user.role not in (User.Role.CLIENT, User.Role.LAB):
            raise PermissionDenied("Only the client or the lab can cancel a booking.")

        booking = get_object_or_404(Booking.objects.for_user(user), pk=pk)

        if not booking.can_cancel():
            return Response(
                {"detail": "Booking cannot be cancelled from its current state."},
                status=status.HTTP_409_CONFLICT,
            )

        booking.cancel()

        from payments.models import Payment

        payment = Payment.objects.filter(booking=booking, status=Payment.Status.SUCCESS).first()
        if payment:
            payment.refund_status = Payment.RefundStatus.SIMULATED_REFUNDED
            payment.save(update_fields=["refund_status"])

        return Response(BookingSerializer(booking).data)
