import {
    useEffect,
    useState,
} from 'react'

import {
    enablePushNotifications,
    disablePushNotifications,
    isPushEnabled,
} from '@/services/pushNotifications'


export default function EnableNotifications() {

    const [
        enabled,
        setEnabled,
    ] = useState(false)


    const [
        loading,
        setLoading,
    ] = useState(false)


    const [
        error,
        setError,
    ] = useState<string | null>(null)


    // ========================================
    // Check current status
    // ========================================

    useEffect(() => {

        const checkStatus =
            async () => {

                try {

                    const result =
                        await isPushEnabled()

                    setEnabled(result)

                } catch (error) {

                    console.error(
                        'Failed to check push status:',
                        error
                    )
                }
            }


        checkStatus()

    }, [])


    // ========================================
    // Enable
    // ========================================

    const handleEnable =
        async () => {

            try {

                setLoading(true)

                setError(null)


                await enablePushNotifications()


                setEnabled(true)

            } catch (error) {

                console.error(error)

                setError(
                    error instanceof Error
                        ? error.message
                        : 'Failed to enable notifications.'
                )

            } finally {

                setLoading(false)
            }
        }


    // ========================================
    // Disable
    // ========================================

    const handleDisable =
        async () => {

            try {

                setLoading(true)

                setError(null)


                await disablePushNotifications()


                setEnabled(false)

            } catch (error) {

                console.error(error)

                setError(
                    error instanceof Error
                        ? error.message
                        : 'Failed to disable notifications.'
                )

            } finally {

                setLoading(false)
            }
        }


    return (
        <div className="space-y-3">

            {enabled ? (

                <button
                    type="button"
                    onClick={handleDisable}
                    disabled={loading}
                    className="
            rounded-lg
            bg-red-600
            px-4
            py-2
            text-white
            transition
            hover:bg-red-700
            disabled:opacity-50
          "
                >
                    {loading
                        ? 'Disabling...'
                        : 'Disable Notifications 🔕'}
                </button>

            ) : (

                <button
                    type="button"
                    onClick={handleEnable}
                    disabled={loading}
                    className="
            rounded-lg
            bg-blue-600
            px-4
            py-2
            text-white
            transition
            hover:bg-blue-700
            disabled:opacity-50
          "
                >
                    {loading
                        ? 'Enabling...'
                        : 'Enable Notifications 🔔'}
                </button>

            )}


            {error && (
                <p className="text-sm text-red-600">
                    {error}
                </p>
            )}

        </div>
    )
}
