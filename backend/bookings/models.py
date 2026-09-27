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
        PENDING = "PENDING", "Payment pending"
        CONFIRMED = "CONFIRMED", "Awaiting arrival"
        FAILED = "FAILED", "Payment failed"
        CANCELLED = "CANCELLED", "Cancelled"
        COMPLETED = "COMPLETED", "Test completed"
        NO_SHOW = "NO_SHOW", "Did not arrive"
        REPORT_DELIVERED = "REPORT_DELIVERED", "Report delivered"

    CANCELLABLE_STATUSES = {Status.PENDING, Status.CONFIRMED}
    # Statuses that hold a seat in their appointment slot (see scheduling.services).
    SLOT_HOLDING_STATUSES = {
        Status.PENDING,
        Status.CONFIRMED,
        Status.COMPLETED,
        Status.NO_SHOW,
        Status.REPORT_DELIVERED,
    }

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


class BookingEvent(models.Model):
    """Append-only history of a booking's status changes: who moved it where, and why."""

    class ActorRole(models.TextChoices):
        CLIENT = "CLIENT", "Client"
        CENTRE = "CENTRE", "Centre"
        LAB = "LAB", "Lab"
        PLATFORM_ADMIN = "PLATFORM_ADMIN", "Platform Admin"
        SYSTEM = "SYSTEM", "System"

    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="events")
    status = models.CharField(max_length=20, choices=Booking.Status.choices)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    actor_role = models.CharField(max_length=20, choices=ActorRole.choices)
    # Why it happened: the cancellation reason, the payment failure reason, etc.
    note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"Booking #{self.booking_id} → {self.status}"
