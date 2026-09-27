from django.db import migrations


def backfill(apps, schema_editor):
    """Gives bookings that predate BookingEvent a history: created, then their current status."""
    Booking = apps.get_model("bookings", "Booking")
    BookingEvent = apps.get_model("bookings", "BookingEvent")
    events, stamps = [], []
    for booking in Booking.objects.filter(events__isnull=True).select_related("client"):
        creator = "CLIENT" if booking.client_id else "CENTRE"
        events.append(BookingEvent(booking=booking, status="PENDING", actor_role=creator))
        stamps.append(booking.created_at)
        if booking.status != "PENDING":
            events.append(BookingEvent(booking=booking, status=booking.status, actor_role="SYSTEM"))
            stamps.append(booking.updated_at)
    created = BookingEvent.objects.bulk_create(events)
    # created_at is auto_now_add, so the real times are written in a second pass.
    for event, stamp in zip(created, stamps):
        event.created_at = stamp
    BookingEvent.objects.bulk_update(created, ["created_at"])


class Migration(migrations.Migration):
    dependencies = [("bookings", "0002_alter_booking_status_bookingevent")]

    operations = [migrations.RunPython(backfill, migrations.RunPython.noop)]
