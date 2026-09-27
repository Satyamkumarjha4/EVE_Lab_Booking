from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.serializers import DetailSerializer

from .models import User
from .serializers import PatientSerializer

DESK_ROLES = (User.Role.CENTRE, User.Role.LAB)


def _require_desk_role(user):
    if user.role not in DESK_ROLES:
        raise PermissionDenied("Only centre or lab staff can look up and register patients.")


@extend_schema(
    summary="Look up a patient by email",
    description=(
        "Centre/lab staff at the desk: find an existing patient (CLIENT account) before booking "
        "a walk-in. 404 if there is none; staff accounts are never returned."
    ),
    parameters=[OpenApiParameter("email", OpenApiTypes.EMAIL, required=True)],
    responses={200: PatientSerializer, 403: DetailSerializer, 404: DetailSerializer},
)
class PatientLookupView(APIView):
    permission_classes = [IsAuthenticated]
    # Own scope, tighter than "default": this endpoint returns another person's PII by
    # email guess, and lookup is intentionally platform-wide (a walk-in can be found at any
    # centre/lab, not just one they've visited before), so it needs its own throttle rather
    # than sharing the roomier default bucket.
    throttle_scope = "patient_lookup"

    def get(self, request):
        _require_desk_role(request.user)
        email = request.query_params.get("email", "").strip()
        if not email:
            raise ValidationError({"email": ["This query parameter is required."]})
        try:
            patient = User.objects.get(email__iexact=email, role=User.Role.CLIENT)
        except User.DoesNotExist:
            raise NotFound("Patient not found.")
        return Response(PatientSerializer(patient).data)


@extend_schema(
    summary="Register a walk-in patient",
    description=(
        "Centre/lab staff: create a patient account (CLIENT role, no password yet) with the "
        "details the lab needs. 400 if the email is already registered; look it up instead."
    ),
    responses={201: PatientSerializer, 400: DetailSerializer, 403: DetailSerializer},
)
class PatientCreateView(generics.CreateAPIView):
    serializer_class = PatientSerializer
    permission_classes = [IsAuthenticated]
    throttle_scope = "default"

    def perform_create(self, serializer):
        _require_desk_role(self.request.user)
        serializer.save()
