from django.db import transaction
from django.utils import timezone

from payments.models import Payment

from .models import Booking


def cancel_booking(booking):
    """Cancels a booking under a row lock and flags a simulated refund if it was already paid.

    Returns the updated booking, or None if its current state doesn't allow cancellation. Locks
    the Booking row first, matching the lock order in payments.services.
    """
    with transaction.atomic():
        locked = Booking.objects.select_for_update().get(pk=booking.pk)
        if not locked.can_cancel():
            return None
        locked.cancel()
        Payment.objects.filter(booking=locked, status=Payment.Status.SUCCESS).update(
            refund_status=Payment.RefundStatus.SIMULATED_REFUNDED, updated_at=timezone.now()
        )
        return locked
