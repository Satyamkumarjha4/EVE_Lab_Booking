from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from accounts.models import User
from catalog.models import CentreTest
from catalog.serializers import CentreSerializer, TestMinimalSerializer
from payments.models import Payment

from .models import Booking, BookingEvent


class BookingCentreTestSerializer(serializers.ModelSerializer):
    centre = CentreSerializer()
    test = TestMinimalSerializer()

    class Meta:
        model = CentreTest
        fields = ["id", "centre", "test", "price"]


class PatientSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "full_name", "phone"]


class PaymentSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = [
            "method",
            "status",
            "failure_reason",
            "refund_status",
            "refund_amount",
            "fee_amount",
        ]


class BookingEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = BookingEvent
        fields = ["status", "actor_role", "note", "created_at"]


class CancellationSerializer(serializers.Serializer):
    reason = serializers.CharField()
    by_role = serializers.ChoiceField(choices=BookingEvent.ActorRole.choices)
    at = serializers.DateTimeField()


class BookingSerializer(serializers.ModelSerializer):
    """Read shape for bookings. Querysets should use `with_details()` in views.py."""

    centre_test = BookingCentreTestSerializer(read_only=True)
    patient = PatientSummarySerializer(source="client", read_only=True, allow_null=True)
    payment = serializers.SerializerMethodField()
    cancellation = serializers.SerializerMethodField()
    events = BookingEventSerializer(many=True, read_only=True)

    class Meta:
        model = Booking
        fields = [
            "id",
            "client",
            "patient",
            "centre_test",
            "appointment_at",
            "amount",
            "status",
            "payment",
            "cancellation",
            "events",
            "created_at",
            "updated_at",
        ]

    @extend_schema_field(PaymentSummarySerializer(allow_null=True))
    def get_payment(self, booking):
        payment = getattr(booking, "payment", None)
        return PaymentSummarySerializer(payment).data if payment is not None else None

    @extend_schema_field(CancellationSerializer(allow_null=True))
    def get_cancellation(self, booking):
        if booking.status != Booking.Status.CANCELLED:
            return None
        event = next(
            (e for e in reversed(booking.events.all()) if e.status == Booking.Status.CANCELLED),
            None,
        )
        if event is None:
            return None
        return {"reason": event.note, "by_role": event.actor_role, "at": event.created_at}


class BookingCreateSerializer(serializers.ModelSerializer):
    patient = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=User.Role.CLIENT),
        required=False,
        help_text="Centre staff only (required for them): the patient being booked in.",
    )

    class Meta:
        model = Booking
        fields = ["centre_test", "appointment_at", "patient"]

    def validate_centre_test(self, value):
        if not value.is_active:
            raise serializers.ValidationError(
                "This test is not currently available at this centre."
            )
        return value

    def validate(self, attrs):
        user = self.context["request"].user
        if user.role == User.Role.CENTRE and "patient" not in attrs:
            raise serializers.ValidationError(
                {"patient": ["Look up or register the patient before booking a walk-in."]}
            )
        if user.role == User.Role.CLIENT and "patient" in attrs:
            raise serializers.ValidationError(
                {"patient": ["Patients can only book for themselves."]}
            )
        return attrs


class CancelBookingSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=255, trim_whitespace=True)
