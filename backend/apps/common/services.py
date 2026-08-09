
import json

from django.conf import settings

from pywebpush import (
    webpush,
    WebPushException,
)

from .models import (
    Notification,
    PushSubscription,
)


def send_push_notification(
    notification: Notification,
):
    subscriptions = (
        PushSubscription.objects
        .filter(
            user=notification.user,
            is_active=True,
        )
    )

    from apps.common.middleware import get_current_request

    url = "/tickets/all"
    if notification.ticket:
        url = f"/tickets/all?ticket_id={notification.ticket.ticket_id}"

    # Determine dynamic absolute image URL
    image_url = notification.image
    if image_url and image_url.startswith('/'):
        request = get_current_request()
        if request:
            image_url = request.build_absolute_uri(image_url)
        else:
            # Fallback for non-request contexts (like background tests/tasks) using ALLOWED_HOSTS or localhost
            image_url = f"http://localhost:8000{image_url}"

    payload = json.dumps(
        {
            "notification_id": notification.notification_id,
            "title": notification.title,
            "message": notification.message,
            "url": url,
            "image": image_url,
        }
    )

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
            print(
                "Web push failed:",
                error,
            )

            # Subscription is no longer valid
            if (
                error.response
                and error.response.status_code in [404, 410]
            ):
                subscription.is_active = False

                subscription.save(
                    update_fields=[
                        "is_active",
                    ]
                )
