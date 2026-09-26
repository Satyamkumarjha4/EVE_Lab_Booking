from django.urls import path

from .views import PaymentOrderCreateView, PaymentSimulateView, PaymentWebhookView

urlpatterns = [
    path("orders/", PaymentOrderCreateView.as_view(), name="payment-order-create"),
    path("webhook/", PaymentWebhookView.as_view(), name="payment-webhook"),
    path("", PaymentSimulateView.as_view(), name="payment-simulate"),
]
