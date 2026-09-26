from rest_framework import serializers

from accounts.models import User
from bookings.models import Booking

from .models import Payment

OUTCOME_CHOICES = [
    (Payment.Status.SUCCESS, Payment.Status.SUCCESS.label),
    (Payment.Status.FAILED, Payment.Status.FAILED.label),
]


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = [
            "id",
            "reference",
            "booking",
            "amount",
            "method",
            "status",
            "refund_status",
            "created_at",
            "updated_at",
        ]


class OrderCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ["id", "reference", "booking", "amount", "method", "status", "created_at"]
        read_only_fields = ["id", "reference", "amount", "status", "created_at"]

    def validate_booking(self, booking):
        user = self.context["request"].user
        if user.role == User.Role.CLIENT and booking.client_id != user.id:
            raise serializers.ValidationError("You do not own this booking.")
        if user.role == User.Role.CENTRE and booking.centre_test.centre_id != user.centre_id:
            raise serializers.ValidationError("This booking does not belong to your centre.")
        if user.role not in (User.Role.CLIENT, User.Role.CENTRE):
            raise serializers.ValidationError("Only clients or centres can create payment orders.")
        if booking.status != Booking.Status.PENDING:
            raise serializers.ValidationError("Only PENDING bookings can have a payment order created.")
        if hasattr(booking, "payment"):
            raise serializers.ValidationError("A payment order already exists for this booking.")
        return booking

    def create(self, validated_data):
        booking = validated_data["booking"]
        return Payment.objects.create(
            booking=booking,
            amount=booking.amount,
            method=validated_data["method"],
        )


class SimulatePaymentSerializer(serializers.Serializer):
    payment_reference = serializers.UUIDField()
    outcome = serializers.ChoiceField(choices=OUTCOME_CHOICES)
