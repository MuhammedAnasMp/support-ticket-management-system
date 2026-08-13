import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Bell, AlertTriangle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { enablePushNotifications, isPushEnabled } from '@/services/pushNotifications';
import type { RootState } from '@/store';

export const PushNotificationPrompt: React.FC = () => {
  const location = useLocation();
  const token = useSelector((state: RootState) => state.auth.token);
  const [showPrompt, setShowPrompt] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'default'
  );

  const isTicketsAllPage = location.pathname === '/tickets/all';

  const checkNotifications = async () => {
    if (!token || !('Notification' in window)) return;

    const todayStr = new Date().toDateString();
    const isPushActive = await isPushEnabled();
    const currentPermission = Notification.permission;

    // Check 3: If push notification setting is ON in localStorage but permission is not granted,
    // automatically trigger the toggle (request permission) and force enable.
    const pushNotificationOnInStorage = localStorage.getItem('push_notifications_enabled') === 'true';

    if (pushNotificationOnInStorage && currentPermission !== 'granted') {
      // Auto-toggle permission automatically
      try {
        setLoading(true);
        await enablePushNotifications();
        localStorage.setItem('push_notifications_enabled', 'true');
        localStorage.setItem('last_notification_check_date', todayStr);
        setPermissionState('granted');
        setShowPrompt(false);
        window.dispatchEvent(new Event('push-subscription-changed'));
        return;
      } catch (err) {
        console.warn('Failed to auto-toggle notification permission:', err);
        // Fall back to showing the forced prompt
      } finally {
        setLoading(false);
      }
    }

    // Daily check:
    // If today has already been checked, and notifications are not currently blocked/disabled in an active session,
    // we respect "check one time daily". But wait! "if not notification is on and force to enable notification in popup"
    // means if it's not active, we MUST force them to enable.
    if (currentPermission === 'granted' && isPushActive) {
      localStorage.setItem('push_notifications_enabled', 'true');
      setShowPrompt(false);
      window.dispatchEvent(new Event('push-subscription-changed'));
      return;
    }

    // If it's not enabled, show the prompt
    setShowPrompt(true);
    localStorage.setItem('last_notification_check_date', todayStr);
  };

  useEffect(() => {
    if (isTicketsAllPage && token) {
      checkNotifications();
    } else {
      setShowPrompt(false);
    }
  }, [isTicketsAllPage, token]);

  const handleEnable = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await enablePushNotifications();
      localStorage.setItem('push_notifications_enabled', 'true');
      const todayStr = new Date().toDateString();
      localStorage.setItem('last_notification_check_date', todayStr);
      setPermissionState('granted');
      setShowPrompt(false);
      window.dispatchEvent(new Event('push-subscription-changed'));
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || 'Failed to enable notifications. Make sure you allow permissions.');
      if ('Notification' in window) {
        setPermissionState(Notification.permission);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!showPrompt) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
        {/* Blur Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative w-full max-w-md bg-surface-container-high dark:bg-dark-surface-container-high rounded-xl shadow-2xl border border-outline-variant dark:border-dark-outline-variant p-6 text-center overflow-hidden"
        >
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-primary/10 dark:bg-primary/20 rounded-full ">
              <Bell className="w-10 h-10 text-primary" />
            </div>
          </div>

          <h3 className="text-lg font-bold text-on-surface dark:text-dark-on-surface mb-2">
            Enable Notifications Required
          </h3>

          <p className="text-xs text-on-surface-variant dark:text-dark-on-surface-variant mb-6 leading-relaxed">
            To access the tickets view, you must enable push notifications. This ensures you receive real-time updates when support tickets are raised, updated, or commented on.
          </p>

          {permissionState === 'denied' && (
            <div className="flex items-start gap-2 bg-error/10 dark:bg-error/20 p-3 rounded border border-error/30 mb-6 text-left text-xs text-error">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Notifications Blocked</p>
                <p className="mt-0.5 leading-relaxed">
                  You have blocked notifications for this site. Please open your browser's site settings (click the lock/info icon next to the URL) and change Notifications to <strong>Allow</strong>, then click retry.
                </p>
              </div>
            </div>
          )}

          {errorMsg && permissionState !== 'denied' && (
            <p className="text-xs text-error font-medium mb-4">{errorMsg}</p>
          )}

          <div className="space-y-3">
            <button
              onClick={handleEnable}
              disabled={loading}
              type="button"
              className="w-full flex items-center justify-center gap-2 py-3 rounded bg-primary text-white text-xs font-bold cursor-pointer hover:bg-primary/95 disabled:opacity-50 transition-all shadow-md hover:shadow-lg"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enabling...
                </>
              ) : (
                'Enable Notifications'
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
