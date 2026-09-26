from django.db import transaction

from bookings.models import Booking

from .models import Payment


def apply_payment_result(payment, status):
    """Shared transition function for both the sync simulate endpoint and the Phase 5 webhook."""
    with transaction.atomic():
        locked_payment = Payment.objects.select_for_update().get(pk=payment.pk)
        if locked_payment.status != Payment.Status.INITIATED:
            return locked_payment

        locked_payment.status = status
        locked_payment.save(update_fields=["status", "updated_at"])

        booking = locked_payment.booking
        booking.status = (
            Booking.Status.CONFIRMED if status == Payment.Status.SUCCESS else Booking.Status.FAILED
        )
        booking.save(update_fields=["status", "updated_at"])

        return locked_payment
