import json
import threading
from django.conf import settings
from pywebpush import webpush, WebPushException
from .models import Notification, PushSubscription


def _send_webpush_async(subscriptions, payload):
    for subscription in subscriptions:
        subscription_info = {
            "endpoint": subscription.endpoint,
            "keys": {
                "p256dh": subscription.p256dh,
                "auth": subscription.auth,
            },
        }

        try:
            webpush(
                subscription_info=subscription_info,
                data=payload,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={
                    "sub": settings.VAPID_EMAIL,
                },
                ttl=60 * 60,
            )

        except WebPushException as error:
            print("Web push failed:", error)
            # Subscription is no longer valid
            if (
                error.response
                and error.response.status_code in [404, 410]
            ):
                try:
                    subscription.is_active = False
                    subscription.save(update_fields=["is_active"])
                except Exception as db_err:
                    print("Failed to deactivate subscription:", db_err)


def send_push_notification(notification: Notification):
    from apps.common.middleware import get_current_request

    subscriptions = list(
        PushSubscription.objects.filter(
            user=notification.user,
            is_active=True,
        )
    )

    if not subscriptions:
        return

    url = "/tickets/all"
    if notification.ticket:
        url = f"/tickets/all?ticket_id={notification.ticket.ticket_id}"

    # Determine dynamic absolute image URL (on main thread where request exists)
    image_url = notification.image
    if image_url and image_url.startswith('/'):
        request = get_current_request()
        if request:
            image_url = request.build_absolute_uri(image_url)
        else:
            image_url = f"http://localhost:8000{image_url}"

    payload = json.dumps(
        {
            "notification_id": notification.notification_id,
            "title": notification.title,
            "message": notification.message,
            "url": url,
            "image": image_url,
            "tag": f"ticket_{notification.ticket.ticket_id}_{notification.notification_type.replace(' ', '_').lower()}" if notification.ticket else None,
            "notification_type": notification.notification_type,
        }
    )

    # Offload the blocking network calls to a background thread
    thread = threading.Thread(
        target=_send_webpush_async,
        args=(subscriptions, payload)
    )
    thread.daemon = True
    thread.start()

