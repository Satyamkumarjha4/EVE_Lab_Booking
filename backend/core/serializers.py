from rest_framework import serializers


class HealthCheckSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["ok", "unavailable"])
    checks = serializers.DictField(child=serializers.BooleanField())


class DetailSerializer(serializers.Serializer):
    """Shape of DRF's standard `{"detail": "..."}` message/error responses, for the schema."""

    detail = serializers.CharField()
