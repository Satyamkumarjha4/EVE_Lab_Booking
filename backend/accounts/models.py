from django.contrib.auth.models import AbstractUser
from django.db import models

from .managers import UserManager


class User(AbstractUser):
    class Role(models.TextChoices):
        PLATFORM_ADMIN = "PLATFORM_ADMIN", "Platform Admin"
        LAB = "LAB", "Lab"
        CENTRE = "CENTRE", "Centre"
        CLIENT = "CLIENT", "Client"

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

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self):
        return self.email
