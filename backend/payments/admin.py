from django.contrib import admin

from .models import Payment, PaymentEvent


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("id", "reference", "booking", "amount", "method", "status", "refund_status")
    list_filter = ("status", "method", "refund_status")


@admin.register(PaymentEvent)
class PaymentEventAdmin(admin.ModelAdmin):
    list_display = ("id", "event_id", "payment", "status", "processed_at", "created_at")
    list_filter = ("status",)
