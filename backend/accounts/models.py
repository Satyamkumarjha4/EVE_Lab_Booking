from django.contrib.auth.models import AbstractUser
from django.db import models

from .managers import UserManager


class User(AbstractUser):
    class Role(models.TextChoices):
        PLATFORM_ADMIN = "PLATFORM_ADMIN", "Platform Admin"
        LAB = "LAB", "Lab"
        CENTRE = "CENTRE", "Centre"
        CLIENT = "CLIENT", "Client"

    class Gender(models.TextChoices):
        MALE = "MALE", "Male"
        FEMALE = "FEMALE", "Female"
        OTHER = "OTHER", "Other"

    username = None
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.CLIENT)
    lab = models.ForeignKey(
        "catalog.Lab",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="staff",
    )
    centre = models.ForeignKey(
        "catalog.Centre",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="staff",
    )

    # Patient details, captured when centre staff register a walk-in. Labs need age and gender to
    # interpret results, so they sit alongside first_name/last_name from AbstractUser.
    phone = models.CharField(max_length=20, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=10, choices=Gender.choices, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self):
        return self.email

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()
