import uuid

from django.db import models


class Payment(models.Model):
    class Method(models.TextChoices):
        CARD = "CARD", "Card"
        UPI = "UPI", "UPI"

    class Status(models.TextChoices):
        INITIATED = "INITIATED", "Initiated"
        SUCCESS = "SUCCESS", "Success"
        FAILED = "FAILED", "Failed"

    class RefundStatus(models.TextChoices):
        NONE = "NONE", "None"
        SIMULATED_REFUNDED = "SIMULATED_REFUNDED", "Simulated Refunded"

    class FailureReason(models.TextChoices):
        INSUFFICIENT_FUNDS = "INSUFFICIENT_FUNDS", "Insufficient funds"
        CARD_DECLINED = "CARD_DECLINED", "Declined by the issuing bank"
        INCORRECT_PIN = "INCORRECT_PIN", "Incorrect PIN or OTP"
        AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED", "Authentication not completed"
        BANK_UNAVAILABLE = "BANK_UNAVAILABLE", "Bank server unavailable"
        TIMED_OUT = "TIMED_OUT", "Payment request timed out"

    booking = models.OneToOneField(
        "bookings.Booking", on_delete=models.PROTECT, related_name="payment"
    )
    reference = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    amount = models.DecimalField(max_digits=8, decimal_places=2)
    method = models.CharField(max_length=10, choices=Method.choices)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.INITIATED)
    refund_status = models.CharField(
        max_length=20, choices=RefundStatus.choices, default=RefundStatus.NONE
    )
    failure_reason = models.CharField(max_length=30, choices=FailureReason.choices, blank=True)
    # A refund may be partial: the lab keeps its transaction fee when the patient cancels a paid
    # booking or doesn't turn up. refund_amount + fee_amount == amount once refunded.
    refund_amount = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    fee_amount = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Payment {self.reference} ({self.status})"


class PaymentEvent(models.Model):
    class Status(models.TextChoices):
        SUCCESS = "SUCCESS", "Success"
        FAILED = "FAILED", "Failed"

    event_id = models.UUIDField(unique=True)
    payment = models.ForeignKey(Payment, on_delete=models.CASCADE, related_name="events")
    status = models.CharField(max_length=10, choices=Status.choices)
    raw_payload = models.JSONField()
    processed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"PaymentEvent {self.event_id} ({self.status})"
