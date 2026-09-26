from drf_spectacular.utils import extend_schema
from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import User
from .serializers import MeSerializer, SignupSerializer


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
    throttle_scope = "auth"


class LoginView(TokenObtainPairView):
    throttle_scope = "auth"


class RefreshView(TokenRefreshView):
    # Refresh tokens are signed and unguessable, so this isn't a brute-force target; keeping it
    # out of the tight `auth` bucket stops routine token refreshes from locking out logins.
    throttle_scope = "default"


@extend_schema(
    summary="Get the current authenticated user",
    description="Returns the logged-in user's id, email, role, lab, and centre.",
    responses={200: MeSerializer},
)
class MeView(generics.RetrieveAPIView):
    serializer_class = MeSerializer
    permission_classes = [IsAuthenticated]
    throttle_scope = "default"

    def get_object(self):
        return self.request.user
