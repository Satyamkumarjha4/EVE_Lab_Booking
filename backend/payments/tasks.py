import json
import logging
import uuid

import requests
from celery import shared_task
from django.conf import settings

from .webhook_security import sign_payload

logger = logging.getLogger(__name__)


@shared_task
def deliver_payment_webhook(payment_reference, outcome):
    """Simulates the payment provider's async confirmation callback for a payment attempt."""
    payload = {
        "event_id": str(uuid.uuid4()),
        "payment_reference": payment_reference,
        "status": outcome,
    }
    body = json.dumps(payload).encode()
    headers = {
        "Content-Type": "application/json",
        "X-Webhook-Signature": sign_payload(body),
    }
    url = f"{settings.INTERNAL_BASE_URL}/payments/webhook/"
    try:
        response = requests.post(url, data=body, headers=headers, timeout=5)
        # Without this, 4xx/5xx replies (e.g. a DisallowedHost 400 or a 429) are silently lost.
        response.raise_for_status()
    except requests.RequestException:
        logger.exception("Webhook delivery failed for payment %s", payment_reference)
