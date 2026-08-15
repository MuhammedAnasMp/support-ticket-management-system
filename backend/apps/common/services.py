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


import os
import subprocess
from PIL import Image

def _compress_image_async(file_path):
    try:
        if not os.path.exists(file_path):
            return

        orig_size = os.path.getsize(file_path)

        with Image.open(file_path) as img:
            fmt = img.format
            if fmt not in ("JPEG", "PNG", "WEBP", "MPO"):
                return

            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")

            max_size = 1920
            width, height = img.size
            if width > max_size or height > max_size:
                if width > height:
                    new_width = max_size
                    new_height = int(height * (max_size / width))
                else:
                    new_height = max_size
                    new_width = int(width * (max_size / height))
                img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

            img.save(file_path, "JPEG", quality=70, optimize=True)
            new_size = os.path.getsize(file_path)
            print(f"[Compression] Image compressed from {orig_size} to {new_size} bytes: {file_path}")
    except Exception as e:
        print(f"[Compression] Error compressing image {file_path}: {e}")


def _compress_video_async(file_path):
    try:
        if not os.path.exists(file_path):
            return

        orig_size = os.path.getsize(file_path)
        temp_file_path = file_path + ".temp.mp4"

        cmd = [
            "ffmpeg",
            "-y",
            "-i", file_path,
            "-vcodec", "libx264",
            "-crf", "28",
            "-preset", "fast",
            "-acodec", "aac",
            "-strict", "-2",
            temp_file_path
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0 and os.path.exists(temp_file_path):
            os.replace(temp_file_path, file_path)
            new_size = os.path.getsize(file_path)
            print(f"[Compression] Video compressed from {orig_size} to {new_size} bytes: {file_path}")
        else:
            print(f"[Compression] FFmpeg failed with code {result.returncode}. Error: {result.stderr}")
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
    except Exception as e:
        print(f"[Compression] Error compressing video {file_path}: {e}")


def compress_media_file_async(file_path):
    ext = os.path.splitext(file_path)[1].lower()
    if ext in (".jpg", ".jpeg", ".png", ".webp"):
        thread = threading.Thread(target=_compress_image_async, args=(file_path,))
        thread.daemon = True
        thread.start()
    elif ext in (".mp4", ".mov", ".avi", ".mkv", ".webm"):
        thread = threading.Thread(target=_compress_video_async, args=(file_path,))
        thread.daemon = True
        thread.start()

