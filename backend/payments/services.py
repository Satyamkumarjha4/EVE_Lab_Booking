from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction

from bookings.events import record_event
from bookings.models import Booking

from .models import Payment

# Lock ordering: every writer that touches a booking and its payment locks the Booking row first,
# then the Payment row (see also bookings.services). A consistent order is what makes concurrent
# pay/cancel/webhook calls serialize instead of deadlocking.

CENT = Decimal("0.01")


class OrderNotOpenable(Exception):
    """The booking stopped being payable between request validation and taking the row lock."""


def refund(payment, fee_percent):
    """Simulates refunding a captured payment, keeping `fee_percent` of it as the lab's fee.

    The caller must hold the payment's row lock.
    """
    fee = (payment.amount * Decimal(fee_percent) / 100).quantize(CENT, rounding=ROUND_HALF_UP)
    payment.fee_amount = fee
    payment.refund_amount = payment.amount - fee
    payment.refund_status = Payment.RefundStatus.SIMULATED_REFUNDED
    payment.save(update_fields=["fee_amount", "refund_amount", "refund_status", "updated_at"])


def open_payment_order(booking, method):
    """Creates the booking's payment order, or resumes its existing INITIATED one.

    Returns (payment, created). One Payment per booking is guaranteed by the booking row lock
    (plus the OneToOne constraint as a backstop), so a retried or double-clicked "Pay" never
    produces a second payment.
    """
    with transaction.atomic():
        locked_booking = Booking.objects.select_for_update().get(pk=booking.pk)
        if locked_booking.status != Booking.Status.PENDING:
            raise OrderNotOpenable
        payment = Payment.objects.filter(booking=locked_booking).first()
        if payment is None:
            payment = Payment.objects.create(
                booking=locked_booking, amount=locked_booking.amount, method=method
            )
            return payment, True
        if payment.status != Payment.Status.INITIATED:
            raise OrderNotOpenable
        if payment.method != method:
            payment.method = method
            payment.save(update_fields=["method", "updated_at"])
        return payment, False


def apply_payment_result(payment, status, failure_reason="", actor=None):
    """Single state-transition path shared by the sync simulate endpoint and the webhook.

    Returns (payment, applied). `applied` is False when the payment was already resolved, in
    which case nothing changes and the caller decides whether that is a conflict. `actor` is the
    user who resolved it, or None for the provider webhook.
    """
    with transaction.atomic():
        booking = Booking.objects.select_for_update().get(pk=payment.booking_id)
        locked_payment = Payment.objects.select_for_update().get(pk=payment.pk)
        if locked_payment.status != Payment.Status.INITIATED:
            return locked_payment, False

        locked_payment.status = status
        update_fields = ["status", "updated_at"]
        if status == Payment.Status.FAILED:
            locked_payment.failure_reason = failure_reason or Payment.FailureReason.CARD_DECLINED
            update_fields.append("failure_reason")
        locked_payment.save(update_fields=update_fields)

        if booking.status == Booking.Status.PENDING:
            succeeded = status == Payment.Status.SUCCESS
            booking.status = Booking.Status.CONFIRMED if succeeded else Booking.Status.FAILED
            booking.save(update_fields=["status", "updated_at"])
            note = "" if succeeded else locked_payment.get_failure_reason_display()
            record_event(booking, booking.status, actor, note)
        elif status == Payment.Status.SUCCESS:
            # The booking was cancelled while this payment was in flight: record the capture
            # truthfully, but refund it in full rather than resurrecting a cancelled booking.
            refund(locked_payment, 0)

        return locked_payment, True
