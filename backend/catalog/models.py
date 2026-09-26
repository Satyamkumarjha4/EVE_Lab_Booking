from django.db import models


class Lab(models.Model):
    name = models.CharField(max_length=255)
    location = models.CharField(max_length=255)
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
