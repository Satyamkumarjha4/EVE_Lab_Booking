from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DEBUG=(bool, False),
)
environ.Env.read_env(BASE_DIR / ".env")

# No fallback on purpose: a missing secret should fail at startup, not silently run with a
# publicly known key (SECRET_KEY also signs the JWTs).
SECRET_KEY = env("SECRET_KEY")
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]
THIRD_PARTY_APPS = [
    "rest_framework",
    "drf_spectacular",
    "corsheaders",
]
LOCAL_APPS = [
    "core",
    "catalog",
    "accounts",
    "bookings",
    "payments",
    "scheduling",
]
INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

AUTH_USER_MODEL = "accounts.User"

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "eve.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "eve.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("POSTGRES_DB", default="eve"),
        "USER": env("POSTGRES_USER", default="eve"),
        "PASSWORD": env("POSTGRES_PASSWORD", default="eve"),
        "HOST": env("POSTGRES_HOST", default="localhost"),
        "PORT": env("POSTGRES_PORT", default="5432"),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- Redis cache ---
REDIS_URL = env("REDIS_URL", default="redis://localhost:6379/0")
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL,
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        },
    }
}

# --- Celery ---
CELERY_BROKER_URL = env("CELERY_BROKER_URL", default="redis://localhost:6379/1")
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", default="redis://localhost:6379/1")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE

# --- DRF / drf-spectacular ---
REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.ScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "auth": "5/min",
        "payments": "20/min",
        # Every webhook arrives from the provider's (here: celery-worker's) address, so it needs
        # its own, roomier bucket instead of sharing the per-user `payments` limit.
        "webhook": "120/min",
        # Patient lookup returns another person's PII by email guess and is intentionally
        # platform-wide, so it gets a tighter bucket than "default" to slow enumeration.
        "patient_lookup": "20/min",
        "default": "100/min",
    },
    # No proxy sits in front of Django here. DRF's default (None) trusts a client-supplied
    # X-Forwarded-For as the throttle identity, which would let anyone reset the login throttle
    # by changing that header.
    "NUM_PROXIES": 0,
}

SPECTACULAR_SETTINGS = {
    "TITLE": "EVE Diagnostics Booking Platform API",
    "DESCRIPTION": "Backend API for the EVE Diagnostics booking and payment simulation platform.",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "ENUM_NAME_OVERRIDES": {
        "BookingStatusEnum": "bookings.models.Booking.Status",
        "PaymentStatusEnum": "payments.models.Payment.Status",
        "PaymentRefundStatusEnum": "payments.models.Payment.RefundStatus",
        # PaymentEvent.status and the simulate/webhook outcome fields share the same
        # SUCCESS/FAILED choice set, so they resolve to one canonical enum name.
        "PaymentOutcomeEnum": "payments.serializers.OUTCOME_CHOICES",
    },
}

# --- JWT (simplejwt) ---
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# --- CORS (local frontend dev server) ---
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=["http://localhost:3000"])

# --- Payment webhook simulation ---
WEBHOOK_SECRET = env("WEBHOOK_SECRET")
# Base URL the celery-worker uses to call back into this service's own webhook endpoint,
# simulating a real provider's async delivery over HTTP.
INTERNAL_BASE_URL = env("INTERNAL_BASE_URL", default="http://localhost:8000")
