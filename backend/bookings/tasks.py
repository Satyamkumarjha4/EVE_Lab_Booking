import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from .models import Booking
from .services import expire_unpaid, mark_no_show

logger = logging.getLogger(__name__)


@shared_task
def expire_unpaid_bookings():
    """Cancels PENDING bookings left unpaid past the payment window, freeing their slots."""
    now = timezone.now()
    cutoff = now - timedelta(minutes=settings.PAYMENT_WINDOW_MINUTES)
    ids = Booking.objects.filter(status=Booking.Status.PENDING, created_at__lte=cutoff)
    # One transaction per booking, re-checked under its row lock: a payment landing mid-sweep wins.
    expired = sum(expire_unpaid(pk, now) for pk in ids.values_list("pk", flat=True))
    if expired:
        logger.info("Expired %d unpaid bookings", expired)
    return expired


@shared_task
def mark_no_shows():
    """Moves CONFIRMED bookings whose appointment passed (plus grace) to NO_SHOW, with refund."""
    now = timezone.now()
    cutoff = now - timedelta(minutes=settings.NO_SHOW_GRACE_MINUTES)
    ids = Booking.objects.filter(status=Booking.Status.CONFIRMED, appointment_at__lte=cutoff)
    marked = sum(mark_no_show(pk, now) for pk in ids.values_list("pk", flat=True))
    if marked:
        logger.info("Marked %d bookings as no-show", marked)
    return marked
