from unittest.mock import patch

import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def _clear_cache():
    """Resets Redis-backed cache (catalog cache + throttle counters) between tests."""
    cache.clear()
    yield


@pytest.fixture(autouse=True)
def webhook_task():
    """Stops tests from enqueueing real Celery tasks on the shared broker.

    Otherwise the running celery-worker would pick them up and call the dev server's webhook
    for payments that only exist in the test database.
    """
    with patch("payments.views.deliver_payment_webhook") as mocked:
        yield mocked
