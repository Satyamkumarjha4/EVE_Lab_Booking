from django.db import migrations
from django.db.models import F


def backfill(apps, schema_editor):
    """Refunds before fees existed were always full refunds."""
    Payment = apps.get_model("payments", "Payment")
    Payment.objects.filter(refund_status="SIMULATED_REFUNDED").update(refund_amount=F("amount"))


class Migration(migrations.Migration):
    dependencies = [("payments", "0003_payment_failure_reason_payment_fee_amount_and_more")]

    operations = [migrations.RunPython(backfill, migrations.RunPython.noop)]
