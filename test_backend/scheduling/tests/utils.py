from datetime import datetime, time, timedelta

from scheduling.services import local_today, local_tz


def local_slot(days_ahead=2, at=time(10)):
    """An aligned appointment in the centre's local time; 10:00 is open every day by default."""
    return datetime.combine(local_today() + timedelta(days=days_ahead), at, local_tz())
