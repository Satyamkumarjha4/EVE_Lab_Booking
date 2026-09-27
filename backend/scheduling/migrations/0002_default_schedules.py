from datetime import time

from django.db import migrations

# A frozen copy of scheduling.services.DEFAULT_WEEKLY_SCHEDULE: migrations mustn't import app code.
DEFAULT_WEEKLY_SCHEDULE = [(weekday, time(7), time(19), 4) for weekday in range(6)] + [
    (6, time(8), time(13), 2)
]


def create_defaults(apps, schema_editor):
    """Existing centres keep taking bookings after slots start being enforced."""
    Centre = apps.get_model("catalog", "Centre")
    SlotRule = apps.get_model("scheduling", "SlotRule")
    SlotRule.objects.bulk_create(
        SlotRule(centre=centre, weekday=weekday, start_time=start, end_time=end, capacity=cap)
        for centre in Centre.objects.filter(slot_rules__isnull=True)
        for weekday, start, end, cap in DEFAULT_WEEKLY_SCHEDULE
    )


class Migration(migrations.Migration):
    dependencies = [("scheduling", "0001_initial"), ("catalog", "0003_lab_transaction_fee_percent")]

    operations = [migrations.RunPython(create_defaults, migrations.RunPython.noop)]
