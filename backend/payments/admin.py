from django.contrib import admin

from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("id", "reference", "booking", "amount", "method", "status", "refund_status")
    list_filter = ("status", "method", "refund_status")
