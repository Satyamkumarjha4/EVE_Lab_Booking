import hashlib
import hmac

from django.conf import settings


def sign_payload(payload: bytes) -> str:
    return hmac.new(settings.WEBHOOK_SECRET.encode(), payload, hashlib.sha256).hexdigest()


def verify_signature(payload: bytes, signature: str) -> bool:
    if not signature:
        return False
    return hmac.compare_digest(sign_payload(payload), signature)
