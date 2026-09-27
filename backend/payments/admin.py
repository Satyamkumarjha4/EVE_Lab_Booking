from django.contrib import admin

from .models import Payment, PaymentEvent


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "reference",
        "booking",
        "amount",
        "method",
        "status",
        "failure_reason",
        "refund_status",
        "refund_amount",
        "fee_amount",
    )
    list_filter = ("status", "method", "refund_status", "failure_reason")


@admin.register(PaymentEvent)
class PaymentEventAdmin(admin.ModelAdmin):
    list_display = ("id", "event_id", "payment", "status", "processed_at", "created_at")
    list_filter = ("status",)
