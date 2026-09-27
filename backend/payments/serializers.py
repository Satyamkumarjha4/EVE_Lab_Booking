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
            "failure_reason",
            "refund_amount",
            "fee_amount",
            "created_at",
            "updated_at",
        ]


class OrderCreateSerializer(serializers.Serializer):
    booking = serializers.PrimaryKeyRelatedField(queryset=Booking.objects.none())
    method = serializers.ChoiceField(choices=Payment.Method.choices)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request is not None and request.user.is_authenticated:
            # Scoping the lookup means someone else's booking id reads as "does not exist"
            # rather than "not yours", so booking ids can't be probed.
            self.fields["booking"].queryset = Booking.objects.for_user(request.user)

    def validate_booking(self, booking):
        user = self.context["request"].user
        if user.role not in (User.Role.CLIENT, User.Role.CENTRE):
            raise serializers.ValidationError("Only clients or centres can create payment orders.")
        if booking.status != Booking.Status.PENDING:
            raise serializers.ValidationError("Only PENDING bookings can be paid for.")
        return booking


class SimulatePaymentSerializer(serializers.Serializer):
    payment_reference = serializers.UUIDField()
    outcome = serializers.ChoiceField(choices=OUTCOME_CHOICES)
    failure_reason = serializers.ChoiceField(
        choices=Payment.FailureReason.choices,
        required=False,
        help_text="Why the bank/UPI app declined (FAILED only). Defaults to CARD_DECLINED.",
    )

    def validate(self, attrs):
        if attrs["outcome"] == Payment.Status.SUCCESS and attrs.get("failure_reason"):
            raise serializers.ValidationError(
                {"failure_reason": ["Only a FAILED outcome has a failure reason."]}
            )
        return attrs


class WebhookEventSerializer(serializers.Serializer):
    event_id = serializers.UUIDField()
    payment_reference = serializers.UUIDField()
    status = serializers.ChoiceField(choices=OUTCOME_CHOICES)
    failure_reason = serializers.ChoiceField(
        choices=Payment.FailureReason.choices, required=False, allow_blank=True
    )
