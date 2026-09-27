from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import generics
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated

from accounts.models import User

from .serializers import LabSettingsSerializer


@extend_schema_view(
    get=extend_schema(summary="Get your lab's settings", description="LAB accounts only."),
    patch=extend_schema(
        summary="Update your lab's settings",
        description=(
            "LAB accounts only. `transaction_fee_percent` (0–100) is kept when a patient cancels "
            "a paid booking or doesn't turn up; the rest is refunded."
        ),
    ),
)
class LabMineView(generics.RetrieveUpdateAPIView):
    serializer_class = LabSettingsSerializer
    permission_classes = [IsAuthenticated]
    throttle_scope = "default"
    http_method_names = ["get", "patch", "options"]

    def get_object(self):
        user = self.request.user
        if user.role != User.Role.LAB or user.lab is None:
            raise PermissionDenied("Only lab accounts have lab settings.")
        return user.lab
