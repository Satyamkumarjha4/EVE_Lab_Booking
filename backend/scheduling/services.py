from collections import Counter
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db.models import Q

from bookings.models import Booking

from .models import SLOT_MINUTES, SlotRule

SLOT = timedelta(minutes=SLOT_MINUTES)

# Mon–Sat 07:00–19:00 with 4 seats per slot, Sunday mornings with 2. Every new centre starts here
# and its staff adjust it.
DEFAULT_WEEKLY_SCHEDULE = [(weekday, time(7), time(19), 4) for weekday in range(6)] + [
    (6, time(8), time(13), 2)
]


class SlotUnavailable(Exception):
    """The requested appointment time can't be booked. `code` is invalid, closed or full."""

    def __init__(self, code, message):
        super().__init__(message)
        self.code = code
        self.message = message


def local_tz():
    return ZoneInfo(settings.CENTRE_TIME_ZONE)


def local_today():
    return datetime.now(local_tz()).date()


def create_default_schedule(centre):
    """Gives a centre the default weekly schedule, unless it already has one."""
    if centre.slot_rules.filter(weekday__isnull=False).exists():
        return
    SlotRule.objects.bulk_create(
        SlotRule(centre=centre, weekday=weekday, start_time=start, end_time=end, capacity=cap)
        for weekday, start, end, cap in DEFAULT_WEEKLY_SCHEDULE
    )


def rules_for_day(rules, day):
    """The rules in effect on `day`: its date overrides if any exist, else its weekday rules."""
    overrides = [r for r in rules if r.date == day]
    if overrides:
        return overrides, "override"
    return [r for r in rules if r.weekday == day.weekday()], "weekly"


def slot_times(rule):
    """Start times of the 30-minute slots a rule covers."""
    base = date(2000, 1, 1)
    moment = datetime.combine(base, rule.start_time)
    end = datetime.combine(base, rule.end_time)
    while moment + SLOT <= end:
        yield moment.time()
        moment += SLOT


def _booked_counts(centre, start, end):
    appointments = Booking.objects.filter(
        centre_test__centre=centre,
        appointment_at__gte=start,
        appointment_at__lt=end,
        status__in=Booking.SLOT_HOLDING_STATUSES,
    ).values_list("appointment_at", flat=True)
    return Counter(appointments)


def day_schedules(centre, first_day, days, now, lead_minutes):
    """Every slot for `days` days from `first_day`, with capacity, seats taken and bookability."""
    tz = local_tz()
    in_range = Q(date__gte=first_day, date__lt=first_day + timedelta(days=days))
    rules = list(centre.slot_rules.filter(Q(weekday__isnull=False) | in_range))
    range_start = datetime.combine(first_day, time(0), tz)
    booked = _booked_counts(centre, range_start, range_start + timedelta(days=days))
    earliest = now + timedelta(minutes=lead_minutes)

    result = []
    for offset in range(days):
        day = first_day + timedelta(days=offset)
        day_rules, source = rules_for_day(rules, day)
        slots = []
        for rule in sorted(day_rules, key=lambda r: r.start_time):
            for slot_time in slot_times(rule):
                start = datetime.combine(day, slot_time, tz)
                taken = booked[start]
                remaining = max(rule.capacity - taken, 0)
                open_in_time = start >= earliest if lead_minutes else start + SLOT > now
                slots.append(
                    {
                        "start": start,
                        "capacity": rule.capacity,
                        "booked": taken,
                        "remaining": remaining,
                        "bookable": remaining > 0 and open_in_time,
                    }
                )
        result.append({"date": day, "source": source, "slots": slots})
    return result


def ensure_bookable(centre, appointment_at, now, lead_minutes):
    """Raises SlotUnavailable unless `appointment_at` is an open slot with a free seat.

    Callers must hold a lock on the centre row so two requests can't both take the last seat.
    """
    local = appointment_at.astimezone(local_tz())
    if local.minute % SLOT_MINUTES or local.second or local.microsecond:
        raise SlotUnavailable(
            "invalid", f"Appointments start on the hour or half hour ({SLOT_MINUTES}-minute slots)."
        )
    if lead_minutes and appointment_at < now + timedelta(minutes=lead_minutes):
        raise SlotUnavailable("invalid", f"Book at least {lead_minutes} minutes ahead.")
    if appointment_at + SLOT <= now:
        raise SlotUnavailable("invalid", "This slot is already over.")

    candidates = centre.slot_rules.filter(Q(weekday=local.weekday()) | Q(date=local.date()))
    rules, _source = rules_for_day(list(candidates), local.date())
    rule = next((r for r in rules if r.start_time <= local.time() < r.end_time), None)
    if rule is None or rule.capacity == 0:
        raise SlotUnavailable("closed", "The centre isn't taking bookings at this time.")

    taken = Booking.objects.filter(
        centre_test__centre=centre,
        appointment_at=appointment_at,
        status__in=Booking.SLOT_HOLDING_STATUSES,
    ).count()
    if taken >= rule.capacity:
        raise SlotUnavailable("full", "This slot is fully booked. Please pick another time.")
