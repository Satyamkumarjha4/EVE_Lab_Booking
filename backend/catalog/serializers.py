from rest_framework import serializers

from .models import Centre, CentreTest, Lab, Test


class LabMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lab
        fields = ["id", "name"]


class CentreSerializer(serializers.ModelSerializer):
    lab = LabMinimalSerializer()

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
