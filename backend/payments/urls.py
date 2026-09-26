from django.urls import path

from .views import PaymentOrderCreateView, PaymentSimulateView

urlpatterns = [
    path("orders/", PaymentOrderCreateView.as_view(), name="payment-order-create"),
    path("", PaymentSimulateView.as_view(), name="payment-simulate"),
]
