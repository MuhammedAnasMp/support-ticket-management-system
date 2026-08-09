import {
    precacheAndRoute,
} from 'workbox-precaching'

declare const self: any

precacheAndRoute(self.__WB_MANIFEST)


// ==========================================
// PUSH NOTIFICATION
// ==========================================

self.addEventListener(
    'push',
    (event: any) => {

        if (!event.data) {
            return
        }

        let data: {
            notification_id?: number
            title?: string
            message?: string
            url?: string
            image?: string
        }

        try {
            data = event.data.json()
        } catch {
            data = {
                title: 'Maintenance Tracker',
                message: event.data.text(),
            }
        }

        const title =
            data.title ||
            'Maintenance Tracker'

        let imageUrl = data.image
        if (imageUrl && imageUrl.startsWith('/')) {
            if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') {
                imageUrl = 'http://localhost:8000' + imageUrl
            } else {
                imageUrl = self.location.origin + imageUrl
            }
        }

        const options: any = {
            body:
                data.message ||
                'You have a new notification.',

            icon: '/pwa-192x192.png',

            badge: '/pwa-192x192.png',

            image: imageUrl || undefined,

            data: {
                notification_id:
                    data.notification_id,

                url: data.url || '/',
            },

            requireInteraction: false,
        }

        event.waitUntil(
            self.registration.showNotification(
                title,
                options
            )
        )
    }
)


// ==========================================
// NOTIFICATION CLICK
// ==========================================

self.addEventListener(
    'notificationclick',
    (event: any) => {

        event.notification.close()

        const url =
            event.notification.data?.url ||
            '/'

        event.waitUntil(
            self.clients.openWindow(url)
        )
    }
)
