from .models import BookingEvent


def record_event(booking, status, actor=None, note=""):
    """Appends a status change to the booking's history. `actor=None` means the system did it."""
    return BookingEvent.objects.create(
        booking=booking,
        status=status,
        actor=actor,
        actor_role=actor.role if actor is not None else BookingEvent.ActorRole.SYSTEM,
        note=note[:255],
    )
