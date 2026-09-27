from datetime import date

from django.conf import settings
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import generics
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from catalog.models import Centre
from catalog.permissions import can_manage_centre

from .serializers import DaySlotsSerializer, SlotRuleSerializer
from .services import day_schedules, local_today

MAX_DAYS = 31


def _visible_centre(user, centre_pk):
    """A centre login only sees its own centre (as in the catalog); everyone else sees any."""
    centre = get_object_or_404(Centre, pk=centre_pk)
    if user.is_authenticated and user.role == User.Role.CENTRE and user.centre_id != centre.id:
        raise Http404
    return centre


@extend_schema(
    summary="Slot availability at a centre",
    description=(
        "Every 30-minute slot for a range of days with its capacity, seats taken and whether it "
        "can still be booked. Times are the centre's local time. Patients must book "
        f"{settings.CLIENT_BOOKING_LEAD_MINUTES} minutes ahead; for a centre's own staff any "
        "slot that hasn't ended is bookable (walk-ins)."
    ),
    parameters=[
        OpenApiParameter("from", OpenApiTypes.DATE, description="First day (default: today)."),
        OpenApiParameter("days", OpenApiTypes.INT, description=f"1–{MAX_DAYS} (default 14)."),
    ],
    responses={200: DaySlotsSerializer(many=True)},
)
class SlotAvailabilityView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "default"

    def get(self, request, centre_pk):
        centre = _visible_centre(request.user, centre_pk)
        try:
            first_day = date.fromisoformat(request.query_params.get("from", ""))
        except ValueError:
            first_day = local_today()
        try:
            days = int(request.query_params.get("days", 14))
        except ValueError:
            raise ValidationError({"days": ["Must be a number."]})
        if not 1 <= days <= MAX_DAYS:
            raise ValidationError({"days": [f"Must be between 1 and {MAX_DAYS}."]})

        staff = request.user.is_authenticated and request.user.role == User.Role.CENTRE
        lead = 0 if staff else settings.CLIENT_BOOKING_LEAD_MINUTES
        schedule = day_schedules(centre, first_day, days, timezone.now(), lead)
        return Response(DaySlotsSerializer(schedule, many=True).data)


class _SlotRuleMixin:
    """Centre staff edit their own centre's slots; the lab can look but not change them."""

    permission_classes = [IsAuthenticated]
    throttle_scope = "default"
    serializer_class = SlotRuleSerializer

    def centre(self):
        if not hasattr(self, "_centre"):
            centre = get_object_or_404(Centre, pk=self.kwargs["centre_pk"])
            user = self.request.user
            if not can_manage_centre(user, centre):
                raise Http404
            writing = self.request.method not in ("GET", "HEAD", "OPTIONS")
            if writing and user.role != User.Role.CENTRE:
                raise PermissionDenied("Only the centre's own staff can change its slots.")
            self._centre = centre
        return self._centre

    def get_queryset(self):
        return self.centre().slot_rules.all()

    def get_serializer_context(self):
        context = super().get_serializer_context()
        # Absent only during OpenAPI schema generation, which builds views without URL kwargs.
        if "centre_pk" in self.kwargs:
            context["centre"] = self.centre()
        return context


@extend_schema_view(
    get=extend_schema(
        summary="List a centre's slot rules",
        description="Weekly rules and date overrides. Readable by the centre's staff and its lab.",
    ),
    post=extend_schema(
        summary="Add a slot rule",
        description=(
            "Centre staff only. Give `weekday` (0 = Monday) for the regular week or `date` for a "
            "one-off override; date rules replace the weekly rules for that whole day. Times are "
            "30-minute aligned local times; capacity is seats per slot (0 = closed)."
        ),
    ),
)
class SlotRuleListCreateView(_SlotRuleMixin, generics.ListCreateAPIView):
    def perform_create(self, serializer):
        serializer.save(centre=self.centre())


@extend_schema_view(
    patch=extend_schema(summary="Change a slot rule", description="Centre staff only."),
    delete=extend_schema(summary="Delete a slot rule", description="Centre staff only."),
)
class SlotRuleDetailView(_SlotRuleMixin, generics.UpdateAPIView, generics.DestroyAPIView):
    http_method_names = ["patch", "delete", "options"]
