from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from accounts.models import User
from catalog.models import Centre
from payments.models import Payment
from payments.services import refund
from scheduling.services import ensure_bookable, local_tz

from .events import record_event
from .models import Booking

# Lock ordering: writers that touch a booking and its payment lock the Booking row first, then
# the Payment row, matching payments.services. Booking creation locks only the Centre row (to
# serialize seat counting per centre) and never a Booking, so the two orders can't deadlock.


class TransitionNotAllowed(Exception):
    """The booking's current state (or time) doesn't allow the requested change."""

    def __init__(self, message):
        super().__init__(message)
        self.message = message


def create_booking(*, centre_test, appointment_at, client, actor):
    """Books a seat in an appointment slot, or raises scheduling.services.SlotUnavailable.

    Patients must book ahead (CLIENT_BOOKING_LEAD_MINUTES); centre staff registering a walk-in
    may use any slot that hasn't ended yet.
    """
    lead = settings.CLIENT_BOOKING_LEAD_MINUTES if actor.role == User.Role.CLIENT else 0
    with transaction.atomic():
        centre = Centre.objects.select_for_update().get(pk=centre_test.centre_id)
        ensure_bookable(centre, appointment_at, timezone.now(), lead)
        booking = Booking.objects.create(
            client=client,
            centre_test=centre_test,
            appointment_at=appointment_at,
            amount=centre_test.price,
            status=Booking.Status.PENDING,
        )
        record_event(booking, Booking.Status.PENDING, actor)
    return booking


def _lock(booking):
    return (
        Booking.objects.select_for_update(of=("self",))
        .select_related("centre_test__centre__lab")
        .get(pk=booking.pk)
    )


def _set_status(booking, status, actor, note=""):
    booking.status = status
    booking.save(update_fields=["status", "updated_at"])
    record_event(booking, status, actor, note)


def _captured_payment(booking):
    return (
        Payment.objects.select_for_update()
        .filter(booking=booking, status=Payment.Status.SUCCESS)
        .first()
    )


def _cancel_locked(booking, actor, reason):
    _set_status(booking, Booking.Status.CANCELLED, actor, reason)
    payment = _captured_payment(booking)
    if payment is not None:
        # The patient cancelling a paid booking pays the lab's fee; a lab-initiated cancellation
        # refunds in full.
        patient_cancelled = actor is not None and actor.role == User.Role.CLIENT
        fee = booking.centre_test.centre.lab.transaction_fee_percent if patient_cancelled else 0
        refund(payment, fee)


def cancel_booking(booking, actor, reason):
    """Cancels a PENDING or CONFIRMED booking before its appointment, refunding any payment."""
    with transaction.atomic():
        locked = _lock(booking)
        if not locked.can_cancel():
            raise TransitionNotAllowed("Booking cannot be cancelled from its current state.")
        if locked.appointment_at <= timezone.now():
            raise TransitionNotAllowed(
                "The appointment time has passed, so the booking can no longer be cancelled."
            )
        _cancel_locked(locked, actor, reason)
        return locked


def complete_booking(booking, actor):
    """The patient came in and the sample was taken. Allowed from the appointment's day on."""
    with transaction.atomic():
        locked = _lock(booking)
        if locked.status != Booking.Status.CONFIRMED:
            raise TransitionNotAllowed("Only a confirmed booking can be marked as completed.")
        appointment_day = locked.appointment_at.astimezone(local_tz()).date()
        if appointment_day > timezone.now().astimezone(local_tz()).date():
            raise TransitionNotAllowed("A booking can be completed from its appointment day on.")
        _set_status(locked, Booking.Status.COMPLETED, actor)
        return locked


def deliver_report(booking, actor):
    with transaction.atomic():
        locked = _lock(booking)
        if locked.status != Booking.Status.COMPLETED:
            raise TransitionNotAllowed("Only a completed test can have its report delivered.")
        _set_status(locked, Booking.Status.REPORT_DELIVERED, actor)
        return locked


def expire_unpaid(booking_id, now):
    """Cancels a booking whose payment window ran out, freeing its slot. Returns True if done."""
    cutoff = now - timedelta(minutes=settings.PAYMENT_WINDOW_MINUTES)
    with transaction.atomic():
        locked = _lock(Booking(pk=booking_id))
        if locked.status != Booking.Status.PENDING or locked.created_at > cutoff:
            return False
        minutes = settings.PAYMENT_WINDOW_MINUTES
        _cancel_locked(locked, None, f"Payment not completed within {minutes} minutes")
        return True


def mark_no_show(booking_id, now):
    """Marks a confirmed booking whose appointment (plus grace) passed unattended as NO_SHOW.

    The lab keeps its transaction fee and the rest of the payment is refunded.
    """
    cutoff = now - timedelta(minutes=settings.NO_SHOW_GRACE_MINUTES)
    with transaction.atomic():
        locked = _lock(Booking(pk=booking_id))
        if locked.status != Booking.Status.CONFIRMED or locked.appointment_at > cutoff:
            return False
        _set_status(locked, Booking.Status.NO_SHOW, None, "Did not arrive for the appointment")
        payment = _captured_payment(locked)
        if payment is not None:
            refund(payment, locked.centre_test.centre.lab.transaction_fee_percent)
        return True
