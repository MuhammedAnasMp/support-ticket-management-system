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
            tag?: string
            notification_type?: string
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

        const actions: any[] = []
        const ntype = (data.notification_type || '').toLowerCase()
        if (
            ntype.includes('high priority') ||
            ntype.includes('location approval') ||
            ntype.includes('completed')
        ) {
            actions.push({
                action: 'approve',
                title: 'Approve',
            })
            actions.push({
                action: 'reject',
                title: 'Reject',
            })
        }

        const options: any = {
            body:
                data.message ||
                'You have a new notification.',

            icon: '/pwa-192x192.png',

            badge: '/pwa-192x192.png',

            image: imageUrl || undefined,

            tag: data.tag || undefined,

            renotify: data.tag ? false : undefined, // False so silent updating, or omit for default browser alerts

            actions: actions.length > 0 ? actions : undefined,

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

        let targetUrl = event.notification.data?.url || '/'
        const action = event.action

        if (action === 'approve') {
            targetUrl += targetUrl.includes('?') ? '&action=approve' : '?action=approve'
        } else if (action === 'reject') {
            targetUrl += targetUrl.includes('?') ? '&action=reject' : '?action=reject'
        }

        event.waitUntil(
            self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList: any) => {
                for (const client of clientList) {
                    if (client.url.startsWith(self.location.origin)) {
                        return client.navigate(targetUrl).then((c: any) => c.focus())
                    }
                }
                return self.clients.openWindow(targetUrl)
            })
        )
    }
)
