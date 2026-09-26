from django.db import transaction

from bookings.models import Booking

from .models import Payment

# Lock ordering: every writer that touches a booking and its payment locks the Booking row first,
# then the Payment row (see also bookings.services.cancel_booking). A consistent order is what
# makes concurrent pay/cancel/webhook calls serialize instead of deadlocking.


class OrderNotOpenable(Exception):
    """The booking stopped being payable between request validation and taking the row lock."""


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


def apply_payment_result(payment, status):
    """Single state-transition path shared by the sync simulate endpoint and the webhook.

    Returns (payment, applied). `applied` is False when the payment was already resolved, in
    which case nothing changes and the caller decides whether that is a conflict.
    """
    with transaction.atomic():
        booking = Booking.objects.select_for_update().get(pk=payment.booking_id)
        locked_payment = Payment.objects.select_for_update().get(pk=payment.pk)
        if locked_payment.status != Payment.Status.INITIATED:
            return locked_payment, False

        locked_payment.status = status
        update_fields = ["status", "updated_at"]

        if booking.status == Booking.Status.PENDING:
            booking.status = (
                Booking.Status.CONFIRMED
                if status == Payment.Status.SUCCESS
                else Booking.Status.FAILED
            )
            booking.save(update_fields=["status", "updated_at"])
        elif status == Payment.Status.SUCCESS:
            # The booking was cancelled while this payment was in flight: record the capture
            # truthfully, but refund it rather than resurrecting a cancelled booking.
            locked_payment.refund_status = Payment.RefundStatus.SIMULATED_REFUNDED
            update_fields.append("refund_status")

        locked_payment.save(update_fields=update_fields)
        return locked_payment, True
