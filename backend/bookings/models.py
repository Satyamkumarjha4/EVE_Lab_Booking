from django.conf import settings
from django.db import models

from accounts.models import User


class BookingQuerySet(models.QuerySet):
    def for_user(self, user):
        if user.role == User.Role.CLIENT:
            return self.filter(client=user)
        if user.role == User.Role.LAB:
            return self.filter(centre_test__centre__lab=user.lab)
        if user.role == User.Role.CENTRE:
            return self.filter(centre_test__centre=user.centre)
        if user.role == User.Role.PLATFORM_ADMIN:
            return self
        return self.none()


class Booking(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        CONFIRMED = "CONFIRMED", "Confirmed"
        FAILED = "FAILED", "Failed"
        CANCELLED = "CANCELLED", "Cancelled"

    CANCELLABLE_STATUSES = {Status.PENDING, Status.CONFIRMED}

    client = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="bookings",
    )
    centre_test = models.ForeignKey(
        "catalog.CentreTest", on_delete=models.PROTECT, related_name="bookings"
    )
    appointment_at = models.DateTimeField()
    amount = models.DecimalField(max_digits=8, decimal_places=2)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = BookingQuerySet.as_manager()

    def __str__(self):
        return f"Booking #{self.id} ({self.status})"

    def can_cancel(self):
        return self.status in self.CANCELLABLE_STATUSES

    def cancel(self):
        self.status = self.Status.CANCELLED
        self.save(update_fields=["status", "updated_at"])
