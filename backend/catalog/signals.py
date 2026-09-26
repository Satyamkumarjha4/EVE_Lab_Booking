from django.core.cache import cache
from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import Centre, CentreTest, Lab, Test

CATALOG_CACHE_PATTERN = "centres:*"


def _clear_catalog_cache():
    cache.delete_pattern(CATALOG_CACHE_PATTERN)


# Lab is included because cached centre payloads embed the lab's name. Any catalog write clears
# every catalog key: writes are rare, and a coarse invalidation can't leave a stale variant behind.
@receiver(post_save, sender=Lab)
@receiver(post_delete, sender=Lab)
@receiver(post_save, sender=Centre)
@receiver(post_delete, sender=Centre)
@receiver(post_save, sender=CentreTest)
@receiver(post_delete, sender=CentreTest)
@receiver(post_save, sender=Test)
@receiver(post_delete, sender=Test)
def invalidate_catalog_cache(sender, **kwargs):
    _clear_catalog_cache()
    # Clear again once the write commits: a read that lands while the transaction is still open
    # sees the old rows and would otherwise re-cache them for a full TTL.
    transaction.on_commit(_clear_catalog_cache)
