import logging
import random

from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from kombu.exceptions import OperationalError
from rest_framework import generics, status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from bookings.models import Booking
from core.serializers import DetailSerializer

from .models import Payment, PaymentEvent
from .serializers import (
    OrderCreateSerializer,
    PaymentSerializer,
    SimulatePaymentSerializer,
    WebhookEventSerializer,
)
from .services import OrderNotOpenable, apply_payment_result, open_payment_order
from .tasks import deliver_payment_webhook
from .webhook_security import verify_signature

logger = logging.getLogger(__name__)

WEBHOOK_DELAY_SECONDS = (2, 8)


def _conflict(detail):
    return Response({"detail": detail}, status=status.HTTP_409_CONFLICT)


@extend_schema(
    summary="Create (or resume) a payment order",
    description=(
        "Opens an INITIATED payment order against a PENDING booking (201). If the booking already "
        "has an INITIATED order, e.g. the user left the checkout and came back, that same order is "
        "returned (200) with the chosen method, so a booking can never end up with two payments."
    ),
    request=OrderCreateSerializer,
    responses={201: PaymentSerializer, 200: PaymentSerializer, 409: DetailSerializer},
)
class PaymentOrderCreateView(generics.GenericAPIView):
    serializer_class = OrderCreateSerializer
    permission_classes = [IsAuthenticated]
    throttle_scope = "payments"

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            payment, created = open_payment_order(
                serializer.validated_data["booking"], serializer.validated_data["method"]
            )
        except OrderNotOpenable:
            return _conflict("This booking is no longer awaiting payment.")
        return Response(
            PaymentSerializer(payment).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


@extend_schema(
    summary="Simulate a payment outcome",
    description=(
        "Assignment-mandated endpoint: synchronously resolves an INITIATED payment to SUCCESS or "
        "FAILED and updates the booking, then enqueues the simulated provider webhook. A FAILED "
        "outcome can carry the decline reason the customer's bank or UPI app gave."
    ),
    request=SimulatePaymentSerializer,
    responses={
        200: PaymentSerializer,
        404: DetailSerializer,
        409: DetailSerializer,
    },
)
class PaymentSimulateView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = "payments"

    def post(self, request):
        serializer = SimulatePaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reference = serializer.validated_data["payment_reference"]
        outcome = serializer.validated_data["outcome"]
        failure_reason = serializer.validated_data.get("failure_reason", "")

        payment = get_object_or_404(
            Payment.objects.select_related("booking__centre_test"), reference=reference
        )
        booking = payment.booking
        user = request.user

        owns = (user.role == User.Role.CLIENT and booking.client_id == user.id) or (
            user.role == User.Role.CENTRE and booking.centre_test.centre_id == user.centre_id
        )
        if not owns:
            # 404, not 403: matches the "outside your scope reads as not found" convention
            # used everywhere else (Booking.objects.for_user(), scheduling's centre lookup),
            # so an unrelated caller can't use the status code to confirm a reference exists.
            raise NotFound("Payment not found.")

        if payment.status != Payment.Status.INITIATED:
            return _conflict("Payment has already been resolved.")
        if booking.status != Booking.Status.PENDING:
            return _conflict("This booking is no longer awaiting payment.")

        resolved, applied = apply_payment_result(payment, outcome, failure_reason, actor=user)
        if not applied:
            return _conflict("Payment has already been resolved.")

        try:
            deliver_payment_webhook.apply_async(
                args=[str(resolved.reference), resolved.status, resolved.failure_reason],
                countdown=random.randint(*WEBHOOK_DELAY_SECONDS),
            )
        except OperationalError:
            # The synchronous result is authoritative and already committed; the webhook is only
            # the provider's async confirmation, so a broker outage must not fail this request.
            logger.exception("Could not enqueue webhook delivery for payment %s", reference)
        return Response(PaymentSerializer(resolved).data)


@extend_schema(
    summary="Payment provider webhook",
    description=(
        "System-to-system callback simulating the provider's async payment confirmation. "
        "Authenticated with an HMAC-SHA256 signature of the raw body (`X-Webhook-Signature`), "
        "not a user JWT. Idempotent on `event_id`: a duplicate delivery is acknowledged with 200 "
        "without being reprocessed. An event that contradicts an already-resolved payment is "
        "logged and ignored; the earlier result stays authoritative."
    ),
    request=WebhookEventSerializer,
    responses={
        200: DetailSerializer,
        403: DetailSerializer,
        404: DetailSerializer,
    },
)
class PaymentWebhookView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_scope = "webhook"

    def post(self, request):
        if not verify_signature(request.body, request.headers.get("X-Webhook-Signature", "")):
            return Response(
                {"detail": "Invalid or missing webhook signature."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = WebhookEventSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        event_id = serializer.validated_data["event_id"]
        reference = serializer.validated_data["payment_reference"]
        event_status = serializer.validated_data["status"]
        failure_reason = serializer.validated_data.get("failure_reason", "")

        payment = get_object_or_404(Payment, reference=reference)

        # Recording the event and applying it happen in one transaction: if processing fails the
        # event row rolls back too, so a provider redelivery is processed instead of being
        # mistaken for a duplicate.
        with transaction.atomic():
            try:
                with transaction.atomic():
                    event = PaymentEvent.objects.create(
                        event_id=event_id,
                        payment=payment,
                        status=event_status,
                        raw_payload=request.data,
                    )
            except IntegrityError:
                original = PaymentEvent.objects.get(event_id=event_id)
                if original.status != event_status or original.raw_payload != request.data:
                    logger.warning(
                        "Webhook event %s redelivered for payment %s with a different "
                        "payload than originally recorded (was %s, now %s) — possible "
                        "tampering or a provider bug; keeping the original.",
                        event_id,
                        reference,
                        original.status,
                        event_status,
                    )
                return Response({"detail": "Duplicate event, already processed."})

            resolved, applied = apply_payment_result(payment, event_status, failure_reason)
            if not applied and resolved.status != event_status:
                logger.warning(
                    "Webhook event %s reports %s for payment %s already resolved as %s; "
                    "keeping the earlier result.",
                    event_id,
                    event_status,
                    reference,
                    resolved.status,
                )

            event.processed_at = timezone.now()
            event.save(update_fields=["processed_at"])
        return Response({"detail": "Event processed."})
