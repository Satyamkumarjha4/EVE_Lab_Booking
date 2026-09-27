from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.http import Http404
from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from accounts.models import User

from .models import Centre, CentreTest, Test
from scheduling.services import create_default_schedule

from .permissions import can_manage_centre, is_lab_of
from .serializers import (
    CentreSerializer,
    CentreTestCreateSerializer,
    CentreTestSerializer,
    CentreTestUpdateSerializer,
    TestMinimalSerializer,
)

CACHE_TTL_SECONDS = 60


def _read_through(cache_key, build):
    data = cache.get(cache_key)
    if data is None:
        data = build()
        cache.set(cache_key, data, CACHE_TTL_SECONDS)
    return data


@extend_schema_view(
    get=extend_schema(
        summary="List centres",
        description=(
            "Lists all centres (public). A CENTRE-role user only sees its own centre. "
            "Read-through cached in Redis for 60s, invalidated on any catalog write."
        ),
    ),
    post=extend_schema(
        summary="Create a centre",
        description=(
            "LAB accounts only: creates a centre under the caller's own lab, with the default "
            "weekly slot schedule (its staff then adjust it)."
        ),
    ),
)
class CentreListCreateView(generics.ListCreateAPIView):
    serializer_class = CentreSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    throttle_scope = "default"

    def list(self, request, *args, **kwargs):
        user = request.user
        queryset = Centre.objects.select_related("lab").order_by("id")
        if user.is_authenticated and user.role == User.Role.CENTRE:
            scope = f"centre:{user.centre_id}"
            queryset = queryset.filter(id=user.centre_id)
        else:
            scope = "all"
        data = _read_through(
            f"centres:list:{scope}", lambda: self.get_serializer(queryset, many=True).data
        )
        return Response(data)

    def perform_create(self, serializer):
        user = self.request.user
        if user.role != User.Role.LAB or user.lab_id is None:
            raise PermissionDenied("Only lab accounts can create centres.")
        with transaction.atomic():
            create_default_schedule(serializer.save(lab=user.lab))


@extend_schema(
    summary="Update a centre",
    description="LAB only (any centre of its own lab): edit name/location.",
)
class CentreUpdateView(generics.UpdateAPIView):
    serializer_class = CentreSerializer
    permission_classes = [IsAuthenticated]
    throttle_scope = "default"
    http_method_names = ["patch", "options"]
    queryset = Centre.objects.select_related("lab")

    def get_object(self):
        centre = super().get_object()
        if not is_lab_of(self.request.user, centre):
            raise PermissionDenied("Only the lab can edit its centres.")
        return centre


@extend_schema_view(
    get=extend_schema(
        summary="List tests offered at a centre",
        description=(
            "Lists active tests and their prices at a centre (public). A CENTRE-role user can only "
            "view its own centre's tests. Read-through cached in Redis for 60s."
        ),
        parameters=[
            OpenApiParameter(
                "include_inactive",
                OpenApiTypes.BOOL,
                description="Also return deactivated tests (honoured for this centre's managers).",
            )
        ],
    ),
    post=extend_schema(
        summary="Offer a test at a centre",
        description=(
            "LAB only (own lab's centres): offer a test from the global catalog (`GET /tests/`) at "
            "a centre-specific price. 400 if the centre already offers it."
        ),
        responses={201: CentreTestSerializer},
    ),
)
class CentreTestListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticatedOrReadOnly]
    throttle_scope = "default"

    def get_serializer_class(self):
        return CentreTestCreateSerializer if self.request.method == "POST" else CentreTestSerializer

    def _centre(self):
        centre = get_object_or_404(Centre, pk=self.kwargs["centre_pk"])
        user = self.request.user
        if user.is_authenticated and user.role == User.Role.CENTRE and user.centre_id != centre.id:
            raise Http404
        return centre

    def list(self, request, *args, **kwargs):
        centre = self._centre()
        queryset = (
            CentreTest.objects.filter(centre=centre).select_related("test").order_by("test__name")
        )
        wants_inactive = request.query_params.get("include_inactive") in ("1", "true")
        if wants_inactive and can_manage_centre(request.user, centre):
            cache_key = f"centres:{centre.id}:tests:all"
        else:
            queryset = queryset.filter(is_active=True)
            cache_key = f"centres:{centre.id}:tests"
        data = _read_through(cache_key, lambda: self.get_serializer(queryset, many=True).data)
        return Response(data)

    def create(self, request, *args, **kwargs):
        centre = self._centre()
        if not is_lab_of(request.user, centre):
            raise PermissionDenied("Only the lab can add tests to its centres.")
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                serializer.save(centre=centre)
        except IntegrityError:
            raise ValidationError(
                {"test": ["This centre already offers this test; update it instead."]}
            )
        return Response(serializer.data, status=status.HTTP_201_CREATED)


@extend_schema(
    summary="Update a test's price or availability at a centre",
    description=(
        "LAB (own lab's centres) can change `price` and `is_active`; CENTRE (own centre) can only "
        "change `is_active`, since prices are set by the lab. Set `is_active=false` to stop "
        "offering a test; rows are never deleted because existing bookings reference them."
    ),
    responses={200: CentreTestSerializer},
)
class CentreTestUpdateView(generics.UpdateAPIView):
    serializer_class = CentreTestUpdateSerializer
    permission_classes = [IsAuthenticated]
    throttle_scope = "default"
    http_method_names = ["patch", "options"]

    def get_queryset(self):
        return CentreTest.objects.filter(centre_id=self.kwargs["centre_pk"]).select_related(
            "centre", "test"
        )

    def get_object(self):
        centre_test = super().get_object()
        user = self.request.user
        if not can_manage_centre(user, centre_test.centre):
            raise PermissionDenied("You can only manage tests at your own centres.")
        if "price" in self.request.data and not is_lab_of(user, centre_test.centre):
            raise PermissionDenied("Only the lab can change prices.")
        return centre_test


@extend_schema(
    summary="List the global test catalog",
    description=(
        "Every test type a centre can offer. Prices are per centre (see /centres/{id}/tests/). "
        "The global catalog itself is curated by the platform admin in Django admin."
    ),
)
class CatalogTestListView(generics.ListAPIView):
    serializer_class = TestMinimalSerializer
    permission_classes = [AllowAny]
    throttle_scope = "default"
    queryset = Test.objects.order_by("name")
