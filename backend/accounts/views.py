from drf_spectacular.utils import extend_schema
from rest_framework import generics
from rest_framework.permissions import AllowAny

from .models import User
from .serializers import SignupSerializer


@extend_schema(
    summary="Sign up as a client",
    description="Creates a new CLIENT-role user. Lab/Centre/Admin accounts are provisioned separately.",
    request=SignupSerializer,
    responses={201: SignupSerializer},
)
class SignupView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = SignupSerializer
    permission_classes = [AllowAny]
    authentication_classes = []
