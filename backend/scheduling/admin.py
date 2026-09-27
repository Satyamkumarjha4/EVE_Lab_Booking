from django.contrib import admin

from .models import SlotRule


@admin.register(SlotRule)
class SlotRuleAdmin(admin.ModelAdmin):
    list_display = ("centre", "weekday", "date", "start_time", "end_time", "capacity")
    list_filter = ("centre", "weekday")
