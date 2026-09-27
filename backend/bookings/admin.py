from django.contrib import admin

from .models import Booking, BookingEvent


class BookingEventInline(admin.TabularInline):
    model = BookingEvent
    extra = 0
    readonly_fields = ("status", "actor", "actor_role", "note", "created_at")
    can_delete = False


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ("id", "client", "centre_test", "appointment_at", "amount", "status")
    list_filter = ("status",)
    inlines = [BookingEventInline]
