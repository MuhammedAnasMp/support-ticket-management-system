interface PushSubscriptionResponse {
    success: boolean
    message?: string
}


function urlBase64ToUint8Array(
    base64String: string
): Uint8Array {

    const padding =
        '='.repeat(
            (4 - (base64String.length % 4)) % 4
        )

    const base64 =
        (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/')

    const rawData =
        window.atob(base64)

    return Uint8Array.from(
        [...rawData].map(
            (char) => char.charCodeAt(0)
        )
    )
}


// ==========================================
// ENABLE PUSH NOTIFICATIONS
// ==========================================

export async function enablePushNotifications() {

    // Browser support
    if (!('Notification' in window)) {
        throw new Error(
            'This browser does not support notifications.'
        )
    }


    // Service worker support
    if (!('serviceWorker' in navigator)) {
        throw new Error(
            'This browser does not support service workers.'
        )
    }


    // Push API support
    if (!('PushManager' in window)) {
        throw new Error(
            'This browser does not support push notifications.'
        )
    }


    // ========================================
    // Request permission
    // ========================================

    const permission =
        await Notification.requestPermission()

    if (permission !== 'granted') {
        throw new Error(
            'Notification permission was denied.'
        )
    }


    // Get service worker (with 10s timeout to avoid silent hangs)
    const swTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(
            'Service Worker is not ready. Make sure the app is loaded over localhost or HTTPS, then hard-refresh (Ctrl+Shift+R) and try again.'
        )), 10000)
    )

    const registration = await Promise.race([
        navigator.serviceWorker.ready,
        swTimeout,
    ])


    // ========================================
    // Check existing subscription
    // ========================================

    let subscription =
        await registration.pushManager
            .getSubscription()


    // ========================================
    // Create subscription
    // ========================================

    if (!subscription) {

        const publicKey =
            import.meta.env
                .VITE_VAPID_PUBLIC_KEY

        if (!publicKey) {
            throw new Error(
                'VITE_VAPID_PUBLIC_KEY is missing.'
            )
        }


        subscription =
            await registration
                .pushManager
                .subscribe({

                    userVisibleOnly: true,

                    applicationServerKey:
                        urlBase64ToUint8Array(
                            publicKey
                        ) as any,
                })
    }


    // ========================================
    // Send subscription to Django
    // ========================================

    const apiUrl =
        import.meta.env.VITE_API_URL || ''

    const token = localStorage.getItem('token')

    if (!token) {
        throw new Error('You must be logged in to enable notifications.')
    }


    const oldEndpoint = localStorage.getItem('last_registered_push_endpoint')

    const response =
        await fetch(
            `${apiUrl}/common/push/subscribe/`,
            {
                method: 'POST',

                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`,
                },

                body: JSON.stringify({
                    subscription:
                        subscription.toJSON(),
                    old_endpoint: oldEndpoint || undefined,
                }),
            }
        )


    if (!response.ok) {

        const errorText =
            await response.text()

        throw new Error(
            errorText ||
            'Failed to save push subscription.'
        )
    }


    const result:
        PushSubscriptionResponse =
        await response.json()


    if (!result.success) {
        throw new Error(
            result.message ||
            'Failed to register notifications.'
        )
    }

    localStorage.setItem('last_registered_push_endpoint', subscription.endpoint)

    return subscription
}


// ==========================================
// DISABLE PUSH NOTIFICATIONS
// ==========================================

export async function disablePushNotifications() {

    const registration =
        await navigator.serviceWorker.ready


    const subscription =
        await registration
            .pushManager
            .getSubscription()


    if (!subscription) {
        return
    }


    const endpoint =
        subscription.endpoint


    await subscription.unsubscribe()


    const apiUrl =
        import.meta.env.VITE_API_URL || ''

    const token = localStorage.getItem('token')


    localStorage.removeItem('last_registered_push_endpoint')

    await fetch(
        `${apiUrl}/common/push/unsubscribe/`,
        {
            method: 'POST',

            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token ${token}`,
            },

            body: JSON.stringify({
                endpoint,
            }),
        }
    )
}


// ==========================================
// CHECK SUBSCRIPTION
// ==========================================

export async function isPushEnabled() {

    if (!('serviceWorker' in navigator)) {
        return false
    }


    const registration =
        await navigator.serviceWorker.ready


    const subscription =
        await registration
            .pushManager
            .getSubscription()


    return (
        subscription !== null
    )
}
