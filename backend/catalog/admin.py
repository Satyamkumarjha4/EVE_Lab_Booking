from django.contrib import admin

from .models import Centre, CentreTest, Lab, Test


@admin.register(Lab)
class LabAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "location", "created_at")


@admin.register(Centre)
class CentreAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "lab", "location", "created_at")
    list_filter = ("lab",)


@admin.register(Test)
class TestAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "created_at")
    search_fields = ("name",)


@admin.register(CentreTest)
class CentreTestAdmin(admin.ModelAdmin):
    list_display = ("id", "test", "centre", "price", "is_active")
    list_filter = ("is_active", "centre")
