from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User

from .models import Payment
from .serializers import OrderCreateSerializer, PaymentSerializer, SimulatePaymentSerializer
from .services import apply_payment_result


@extend_schema(
    summary="Create a payment order",
    description="Creates an INITIATED payment order against a PENDING booking.",
)
class PaymentOrderCreateView(generics.CreateAPIView):
    serializer_class = OrderCreateSerializer
    permission_classes = [IsAuthenticated]


@extend_schema(
    summary="Simulate a payment outcome",
    description="Assignment-mandated endpoint: synchronously resolves an INITIATED payment.",
    request=SimulatePaymentSerializer,
    responses={200: PaymentSerializer},
)
class PaymentSimulateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = SimulatePaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reference = serializer.validated_data["payment_reference"]
        outcome = serializer.validated_data["outcome"]

        payment = get_object_or_404(Payment, reference=reference)
        booking = payment.booking
        user = request.user

        owns = (user.role == User.Role.CLIENT and booking.client_id == user.id) or (
            user.role == User.Role.CENTRE and booking.centre_test.centre_id == user.centre_id
        )
        if not owns:
            raise PermissionDenied("You do not have access to this payment.")

        if payment.status != Payment.Status.INITIATED:
            return Response(
                {"detail": "Payment has already been resolved."},
                status=status.HTTP_409_CONFLICT,
            )

        updated_payment = apply_payment_result(payment, outcome)
        return Response(PaymentSerializer(updated_payment).data)
