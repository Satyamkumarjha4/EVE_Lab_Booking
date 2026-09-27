"""Turns a demo booking's final outcome into the history the real flow would have left behind.

Used only by the seed_demo_bookings command.
"""

import random
from dataclasses import dataclass, field
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings

from bookings.models import Booking, BookingEvent
from payments.models import Payment

S = Booking.Status
ROLE = BookingEvent.ActorRole

PATIENT_CANCEL_REASONS = [
    "Schedule conflict",
    "Booked the wrong test",
    "Feeling unwell, will rebook",
    "Found a centre closer to home",
    "Doctor advised a different test",
]
LAB_CANCEL_REASONS = [
    "Analyser under maintenance",
    "Technician unavailable",
    "Reagent out of stock",
]


@dataclass
class Story:
    status: str
    events: list = field(default_factory=list)  # (status, at, actor_role, actor, note)
    payment: Payment | None = None

    @property
    def updated_at(self):
        return self.events[-1][1]


def _fee_split(amount, percent):
    fee = (amount * Decimal(percent) / 100).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return amount - fee, fee


def tell(outcome, *, amount, created_at, appointment_at, booker, staff, fee_percent, now):
    """The events and payment for a booking that ended in `outcome`.

    `booker` is (role, user) for whoever made the booking; `staff` is the centre's staff user (or
    None) credited with completing tests and delivering reports.
    """
    booker_role, booker_user = booker
    story = Story(outcome, [(S.PENDING, created_at, booker_role, booker_user, "")])
    paid_at = created_at + timedelta(minutes=random.randint(1, 6))
    method = random.choice(Payment.Method.values)

    def add(status, at, role, actor=None, note=""):
        story.events.append((status, at, role, actor, note))

    def captured(refund_percent=None):
        payment = Payment(amount=amount, method=method, status=Payment.Status.SUCCESS)
        if refund_percent is not None:
            payment.refund_amount, payment.fee_amount = _fee_split(amount, refund_percent)
            payment.refund_status = Payment.RefundStatus.SIMULATED_REFUNDED
        story.payment = payment

    if outcome == S.PENDING:
        if random.random() < 0.4:
            story.payment = Payment(amount=amount, method=method)
        return story

    if outcome == S.FAILED:
        reason = random.choice(Payment.FailureReason.values)
        story.payment = Payment(
            amount=amount, method=method, status=Payment.Status.FAILED, failure_reason=reason
        )
        add(S.FAILED, paid_at, booker_role, booker_user, Payment.FailureReason(reason).label)
        return story

    if outcome == S.CANCELLED:
        kind = random.choices(["expired", "patient", "lab"], weights=[3, 5, 2])[0]
        if kind == "expired":
            minutes = settings.PAYMENT_WINDOW_MINUTES
            note = f"Payment not completed within {minutes} minutes"
            add(S.CANCELLED, created_at + timedelta(minutes=minutes), ROLE.SYSTEM, note=note)
            return story
        add(S.CONFIRMED, paid_at, booker_role, booker_user)
        cancel_at = min(paid_at + timedelta(hours=random.randint(2, 30)), appointment_at, now)
        if kind == "patient":
            captured(refund_percent=fee_percent)
            add(S.CANCELLED, cancel_at, ROLE.CLIENT, note=random.choice(PATIENT_CANCEL_REASONS))
        else:
            captured(refund_percent=0)
            add(S.CANCELLED, cancel_at, ROLE.LAB, note=random.choice(LAB_CANCEL_REASONS))
        return story

    # Everything else was paid for.
    add(S.CONFIRMED, paid_at, booker_role, booker_user)
    if outcome == S.CONFIRMED:
        captured()
    elif outcome == S.NO_SHOW:
        captured(refund_percent=fee_percent)
        grace = timedelta(minutes=settings.NO_SHOW_GRACE_MINUTES)
        add(
            S.NO_SHOW,
            appointment_at + grace,
            ROLE.SYSTEM,
            note="Did not arrive for the appointment",
        )
    else:
        captured()
        done_at = appointment_at + timedelta(minutes=random.randint(10, 40))
        add(S.COMPLETED, done_at, ROLE.CENTRE, staff)
        report_at = done_at + timedelta(hours=random.randint(6, 48))
        if outcome == S.REPORT_DELIVERED and report_at < now:
            add(S.REPORT_DELIVERED, report_at, ROLE.CENTRE, staff)
        else:
            story.status = S.COMPLETED
    return story
