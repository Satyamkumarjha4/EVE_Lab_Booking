from django.utils import timezone
from rest_framework import serializers

from accounts.models import User
from catalog.models import CentreTest
from catalog.serializers import CentreSerializer, TestMinimalSerializer

from .models import Booking


class BookingCentreTestSerializer(serializers.ModelSerializer):
    centre = CentreSerializer()
    test = TestMinimalSerializer()

    class Meta:
        model = CentreTest
        fields = ["id", "centre", "test", "price"]


class BookingSerializer(serializers.ModelSerializer):
    centre_test = BookingCentreTestSerializer(read_only=True)

    class Meta:
        model = Booking
        fields = [
            "id",
            "client",
            "centre_test",
            "appointment_at",
            "amount",
            "status",
            "created_at",
            "updated_at",
        ]


class BookingCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = ["id", "centre_test", "appointment_at", "amount", "status", "client", "created_at"]
        read_only_fields = ["id", "amount", "status", "client", "created_at"]

    def validate_centre_test(self, value):
        if not value.is_active:
            raise serializers.ValidationError("This test is not currently available at this centre.")
        return value

    def validate_appointment_at(self, value):
        if value <= timezone.now():
            raise serializers.ValidationError("Appointment must be in the future.")
        return value

    def create(self, validated_data):
        user = self.context["request"].user
        centre_test = validated_data["centre_test"]
        return Booking.objects.create(
            client=user if user.role == User.Role.CLIENT else None,
            centre_test=centre_test,
            appointment_at=validated_data["appointment_at"],
            amount=centre_test.price,
            status=Booking.Status.PENDING,
        )
