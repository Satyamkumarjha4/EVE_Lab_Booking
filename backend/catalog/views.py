from django.http import Http404
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics
from rest_framework.permissions import AllowAny

from accounts.models import User

from .models import Centre, CentreTest
from .serializers import CentreSerializer, CentreTestSerializer


@extend_schema(
    summary="List centres",
    description="Lists all centres. A CENTRE-role user only sees its own centre.",
)
class CentreListView(generics.ListAPIView):
    serializer_class = CentreSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        queryset = Centre.objects.select_related("lab").all()
        user = self.request.user
        if user.is_authenticated and user.role == User.Role.CENTRE:
            return queryset.filter(id=user.centre_id)
        return queryset


@extend_schema(
    summary="List tests offered at a centre",
    description=(
        "Lists active tests and their prices at a centre. A CENTRE-role user can only view "
        "its own centre's tests."
    ),
)
class CentreTestListView(generics.ListAPIView):
    serializer_class = CentreTestSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        centre = get_object_or_404(Centre, pk=self.kwargs["pk"])
        user = self.request.user
        if user.is_authenticated and user.role == User.Role.CENTRE and user.centre_id != centre.id:
            raise Http404
        return CentreTest.objects.filter(centre=centre, is_active=True).select_related("test")
