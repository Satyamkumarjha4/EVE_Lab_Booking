from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q

SLOT_MINUTES = 30
MAX_SLOT_CAPACITY = 50


class SlotRule(models.Model):
    """How many patients a centre can take per 30-minute slot within a time range.

    A rule applies either to a weekday (the centre's regular week) or to one date (an override).
    If a centre has any date rules for a date, they replace its weekday rules for that whole day.
    Times are the centre's local time (settings.CENTRE_TIME_ZONE). Capacity 0 means closed.
    """

    centre = models.ForeignKey(
        "catalog.Centre", on_delete=models.CASCADE, related_name="slot_rules"
    )
    weekday = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=[MaxValueValidator(6)], help_text="0 = Monday"
    )
    date = models.DateField(null=True, blank=True)
    start_time = models.TimeField()
    end_time = models.TimeField()
    capacity = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(MAX_SLOT_CAPACITY)]
    )

    class Meta:
        ordering = ["weekday", "date", "start_time"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(weekday__isnull=False, date__isnull=True)
                    | Q(weekday__isnull=True, date__isnull=False)
                ),
                name="slot_rule_weekday_xor_date",
            ),
            models.CheckConstraint(
                condition=Q(end_time__gt=models.F("start_time")),
                name="slot_rule_end_after_start",
            ),
        ]

    def __str__(self):
        when = self.date or f"weekday {self.weekday}"
        return f"{self.centre} {when} {self.start_time}–{self.end_time} ×{self.capacity}"
