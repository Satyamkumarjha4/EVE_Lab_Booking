from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import serializers

from .models import User


class SignupSerializer(serializers.ModelSerializer):
    # Declared explicitly so the model's case-sensitive UniqueValidator isn't auto-attached;
    # uniqueness is checked case-insensitively in validate_email instead.
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "password"]
        read_only_fields = ["id"]

    def validate_email(self, value):
        email = value.lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return email

    def validate(self, attrs):
        try:
            validate_password(attrs["password"], user=User(email=attrs["email"]))
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            role=User.Role.CLIENT,
        )


class MeSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "role", "lab", "centre"]
        read_only_fields = fields


class PatientSerializer(serializers.ModelSerializer):
    """A patient as centre staff see them at the desk. Registering one creates a CLIENT account
    without a usable password (the patient hasn't chosen one)."""

    email = serializers.EmailField(max_length=254)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    phone = serializers.RegexField(r"^\+?[0-9 ]{7,20}$", max_length=20)
    date_of_birth = serializers.DateField()
    gender = serializers.ChoiceField(choices=User.Gender.choices)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "phone",
            "date_of_birth",
            "gender",
        ]
        read_only_fields = ["id", "full_name"]

    def validate_email(self, value):
        email = value.lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return email

    def validate_date_of_birth(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError("Date of birth can't be in the future.")
        return value

    def create(self, validated_data):
        return User.objects.create_user(password=None, role=User.Role.CLIENT, **validated_data)
