from decimal import Decimal

from rest_framework import serializers

from .models import Centre, CentreTest, Lab, Test


class LabMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lab
        fields = ["id", "name", "transaction_fee_percent"]


class LabSettingsSerializer(serializers.ModelSerializer):
    transaction_fee_percent = serializers.DecimalField(
        max_digits=5, decimal_places=2, min_value=Decimal("0"), max_value=Decimal("100")
    )

    class Meta:
        model = Lab
        fields = ["id", "name", "transaction_fee_percent"]
        read_only_fields = ["id"]


class CentreSerializer(serializers.ModelSerializer):
    lab = LabMinimalSerializer(read_only=True)

    class Meta:
        model = Centre
        fields = ["id", "name", "location", "lab"]


class TestMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Test
        fields = ["id", "name", "description"]


class CentreTestSerializer(serializers.ModelSerializer):
    test = TestMinimalSerializer()

    class Meta:
        model = CentreTest
        fields = ["id", "price", "is_active", "test"]


class CentreTestCreateSerializer(serializers.ModelSerializer):
    price = serializers.DecimalField(max_digits=8, decimal_places=2, min_value=Decimal("0.01"))
    # Explicit default: without it, a form-encoded request that omits the field is read as an
    # unticked checkbox (False) and silently creates an inactive offering.
    is_active = serializers.BooleanField(default=True)

    class Meta:
        model = CentreTest
        fields = ["test", "price", "is_active"]

    def to_representation(self, instance):
        return CentreTestSerializer(instance).data


class CentreTestUpdateSerializer(serializers.ModelSerializer):
    price = serializers.DecimalField(
        max_digits=8, decimal_places=2, min_value=Decimal("0.01"), required=False
    )

    class Meta:
        model = CentreTest
        fields = ["price", "is_active"]

    def to_representation(self, instance):
        return CentreTestSerializer(instance).data
