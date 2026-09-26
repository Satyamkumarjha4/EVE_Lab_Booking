from django.contrib import admin

from .models import Centre, Lab


@admin.register(Lab)
class LabAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "location", "created_at")


@admin.register(Centre)
class CentreAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "lab", "location", "created_at")
    list_filter = ("lab",)
