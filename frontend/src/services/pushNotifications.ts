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
// HELPER: GET SERVICE WORKER REGISTRATION
// ==========================================

async function waitActive(registration: ServiceWorkerRegistration): Promise<ServiceWorkerRegistration> {
    if (registration.active) {
        return registration
    }

    const serviceWorker = registration.installing || registration.waiting
    if (!serviceWorker) {
        return registration
    }

    return new Promise((resolve) => {
        const stateChangeHandler = () => {
            if (serviceWorker.state === 'activated' || registration.active) {
                serviceWorker.removeEventListener('statechange', stateChangeHandler)
                resolve(registration)
            }
        }
        serviceWorker.addEventListener('statechange', stateChangeHandler)
        if (serviceWorker.state === 'activated' || registration.active) {
            serviceWorker.removeEventListener('statechange', stateChangeHandler)
            resolve(registration)
        }
        // Safety timeout of 5 seconds to avoid hanging
        setTimeout(() => {
            serviceWorker.removeEventListener('statechange', stateChangeHandler)
            resolve(registration)
        }, 5000)
    })
}

async function getSWRegistration(): Promise<ServiceWorkerRegistration> {
    if (!('serviceWorker' in navigator)) {
        throw new Error('This browser does not support service workers.')
    }

    // 1. Try navigator.serviceWorker.ready with a 2-second timeout
    try {
        const readyPromise = navigator.serviceWorker.ready
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000))
        const reg = await Promise.race([readyPromise, timeoutPromise])
        if (reg) return await waitActive(reg)
    } catch {
        // ignore timeout/error
    }

    // 2. Check existing registrations via getRegistrations() or getRegistration()
    try {
        const registrations = await navigator.serviceWorker.getRegistrations()
        if (registrations && registrations.length > 0) {
            const activeReg = registrations.find(r => r.active || r.installing || r.waiting) || registrations[0]
            if (activeReg) return await waitActive(activeReg)
        }
        const singleReg = await navigator.serviceWorker.getRegistration()
        if (singleReg) return await waitActive(singleReg)
    } catch {
        // ignore error
    }

    // 3. Fallback: Register the service worker manually if it hasn't been registered yet
    try {
        const baseUrl = (import.meta.env.BASE_URL || '/static/').replace(/\/+$/, '/')
        const swUrl = baseUrl + 'sw.js'
        const reg = await navigator.serviceWorker.register(swUrl)
        return await waitActive(reg)
    } catch (err: any) {
        throw new Error(
            'Service Worker is not ready. Make sure the app is loaded over localhost or HTTPS, then hard-refresh (Ctrl+Shift+R) and try again.'
        )
    }
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


    // Get service worker registration reliably
    const registration = await getSWRegistration()


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
        await getSWRegistration()


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

    try {
        const registration =
            await getSWRegistration()

        const subscription =
            await registration
                .pushManager
                .getSubscription()

        return (
            subscription !== null
        )
    } catch {
        return false
    }
}
