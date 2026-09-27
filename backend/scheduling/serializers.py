from django.db.models import Q
from rest_framework import serializers

from .models import SLOT_MINUTES, SlotRule
from .services import local_today, local_tz


class SlotRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = SlotRule
        fields = ["id", "weekday", "date", "start_time", "end_time", "capacity"]

    def validate_start_time(self, value):
        return _aligned(value)

    def validate_end_time(self, value):
        return _aligned(value)

    def validate_date(self, value):
        if value is not None and value < local_today():
            raise serializers.ValidationError("Overrides can only be set for today or later.")
        return value

    def validate(self, attrs):
        merged = {
            field: attrs.get(field, getattr(self.instance, field, None))
            for field in ("weekday", "date", "start_time", "end_time")
        }
        if (merged["weekday"] is None) == (merged["date"] is None):
            raise serializers.ValidationError("Set exactly one of `weekday` or `date`.")
        if merged["end_time"] <= merged["start_time"]:
            raise serializers.ValidationError({"end_time": ["Must be after the start time."]})

        centre = self.context["centre"]
        same_day = (
            Q(weekday=merged["weekday"])
            if merged["weekday"] is not None
            else Q(date=merged["date"])
        )
        overlapping = centre.slot_rules.filter(
            same_day, start_time__lt=merged["end_time"], end_time__gt=merged["start_time"]
        )
        if self.instance is not None:
            overlapping = overlapping.exclude(pk=self.instance.pk)
        if overlapping.exists():
            raise serializers.ValidationError("This time range overlaps another rule for that day.")
        return attrs


def _aligned(value):
    if value.minute % SLOT_MINUTES or value.second or value.microsecond:
        raise serializers.ValidationError(
            f"Use {SLOT_MINUTES}-minute boundaries, e.g. 09:00 or 09:30."
        )
    return value


class SlotSerializer(serializers.Serializer):
    # Rendered in the centre's local time (+05:30) so a slot reads as the time on the wall clock.
    start = serializers.DateTimeField(default_timezone=local_tz())
    capacity = serializers.IntegerField()
    booked = serializers.IntegerField()
    remaining = serializers.IntegerField()
    bookable = serializers.BooleanField()


class DaySlotsSerializer(serializers.Serializer):
    date = serializers.DateField()
    source = serializers.ChoiceField(choices=["weekly", "override"])
    slots = SlotSerializer(many=True)
