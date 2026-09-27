from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Lab(models.Model):
    name = models.CharField(max_length=255)
    location = models.CharField(max_length=255)
    # Kept from a paid booking when the patient cancels after payment or doesn't turn up; the rest
    # is refunded. Set by the lab itself.
    transaction_fee_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("5.00"),
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("100"))],
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Centre(models.Model):
    lab = models.ForeignKey(Lab, on_delete=models.PROTECT, related_name="centres")
    name = models.CharField(max_length=255)
    location = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Test(models.Model):
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class CentreTest(models.Model):
    centre = models.ForeignKey(Centre, on_delete=models.CASCADE, related_name="centre_tests")
    test = models.ForeignKey(Test, on_delete=models.PROTECT, related_name="centre_tests")
    price = models.DecimalField(max_digits=8, decimal_places=2)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("centre", "test")

    def __str__(self):
        return f"{self.test.name} @ {self.centre.name}"
