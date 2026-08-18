import React, { useEffect, useState } from 'react'
import { X, Share, PlusSquare, Download } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

type Platform = 'ios' | 'android' | 'desktop' | null

function getPlatform(): Platform {
  const ua = navigator.userAgent

  // iOS / iPadOS
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  if (isIOS) {
    const isSafari =
      /safari/i.test(ua) &&
      !/crios|fxios|edgios/i.test(ua)

    return isSafari ? 'ios' : null
  }

  // Android
  if (/android/i.test(ua)) {
    return 'android'
  }

  // Desktop Chromium browsers
  if (/chrome|chromium|edg/i.test(ua)) {
    return 'desktop'
  }

  return null
}

function isInstalled(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  )
}

const DISMISSED_KEY = 'mt-pwa-dismissed'

export const PwaInstallPrompt: React.FC = () => {
  const [visible, setVisible] = useState(false)
  const [platform, setPlatform] = useState<Platform>(null)
  const [nativePrompt, setNativePrompt] = useState<any>(null)

  useEffect(() => {
    // Already installed as PWA
    if (isInstalled()) return

    // User dismissed it this session
    if (sessionStorage.getItem(DISMISSED_KEY)) return

    const p = getPlatform()

    if (!p) return

    setPlatform(p)

    // Check if prompt was captured before React mounted
    const existingPrompt = (window as any).__pwaInstallPrompt

    if (existingPrompt) {
      setNativePrompt(existingPrompt)
    }

    // Listen for prompt captured by main.tsx
    const handleInstallReady = () => {
      const prompt = (window as any).__pwaInstallPrompt

      if (prompt) {
        setNativePrompt(prompt)
      }
    }

    window.addEventListener(
      'pwaInstallReady',
      handleInstallReady
    )

    // If iOS, show manual Safari instructions.
    // For Android/Desktop we ONLY show the UI when
    // the real native install prompt exists.
    const timer = setTimeout(() => {
      if (p === 'ios') {
        setVisible(true)
        return
      }

      if ((window as any).__pwaInstallPrompt) {
        setVisible(true)
      }
    }, 1500)

    return () => {
      clearTimeout(timer)

      window.removeEventListener(
        'pwaInstallReady',
        handleInstallReady
      )
    }
  }, [])

  // If native prompt becomes available after the component loaded
  useEffect(() => {
    if (nativePrompt && !isInstalled()) {
      setVisible(true)
    }
  }, [nativePrompt])

  const dismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, 'true')
    setVisible(false)
  }

  const handleNativeInstall = async () => {
    if (!nativePrompt) return

    try {
      await nativePrompt.prompt()

      const { outcome } =
        await nativePrompt.userChoice

      console.log('PWA install result:', outcome)

        // The prompt cannot be reused
        ; (window as any).__pwaInstallPrompt = null
      setNativePrompt(null)

      if (outcome === 'accepted') {
        setVisible(false)
      }
    } catch (error) {
      console.error(
        'PWA installation failed:',
        error
      )
    }
  }

  if (!platform) return null

  /*
   * IMPORTANT:
   *
   * Android/Desktop:
   * Only show the component if the browser provided
   * beforeinstallprompt.
   *
   * Therefore there is NO "Add to Home Screen"
   * fallback.
   */

  if (
    platform !== 'ios' &&
    !nativePrompt
  ) {
    return null
  }

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            key="pwa-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm"
            onClick={dismiss}
          />

          {/* Card */}
          <motion.div
            key="pwa-card"
            initial={{ opacity: 0, y: 80 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 80 }}
            transition={{
              type: 'spring',
              damping: 22,
              stiffness: 250,
            }}
            className="fixed inset-x-0 bottom-0 z-[9999] flex justify-center p-4 pb-6"
          >
            <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">

              {/* Header */}
              <div className="flex items-start justify-between p-5 pb-4">
                <div className="flex items-center gap-3">
                  <img
                    src={`${import.meta.env.BASE_URL}icon-192x192.png`}
                    alt="App Icon"
                    className="w-12 h-12 rounded-xl shadow border border-zinc-100 dark:border-zinc-700 object-cover"
                  />

                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                      Install Maintenance Tracker
                    </h3>

                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {platform === 'ios'
                        ? 'Install the app on your iPhone or iPad'
                        : platform === 'android'
                          ? 'Install the app on your Android device'
                          : 'Install the app on your computer'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={dismiss}
                  type="button"
                  className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* ===================================== */}
              {/* ANDROID / DESKTOP - NATIVE INSTALL */}
              {/* ===================================== */}

              {(platform === 'android' ||
                platform === 'desktop') &&
                nativePrompt && (
                  <div className="px-5 pb-5 space-y-3">

                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Install Maintenance Tracker as an app
                      for a faster, full-screen experience.
                    </p>

                    <button
                      onClick={handleNativeInstall}
                      type="button"
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white text-xs font-bold cursor-pointer hover:bg-primary/90 active:scale-95 transition-all"
                    >
                      <Download className="w-4 h-4" />
                      Install App
                    </button>

                    <button
                      onClick={dismiss}
                      type="button"
                      className="w-full py-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400"
                    >
                      Not now
                    </button>
                  </div>
                )}

              {/* ===================================== */}
              {/* iOS - SAFARI */}
              {/* ===================================== */}

              {platform === 'ios' && (
                <div className="px-5 pb-5 space-y-3">

                  <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800 p-3 rounded-xl border border-zinc-100 dark:border-zinc-700">

                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-700 shadow-sm border border-zinc-100 dark:border-zinc-600 flex items-center justify-center shrink-0">
                      <Share className="w-4 h-4 text-primary" />
                    </div>

                    <p className="text-xs text-zinc-700 dark:text-zinc-300">
                      1. Tap the <strong>Share</strong> button in Safari.
                    </p>

                  </div>

                  <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800 p-3 rounded-xl border border-zinc-100 dark:border-zinc-700">

                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-700 shadow-sm border border-zinc-100 dark:border-zinc-600 flex items-center justify-center shrink-0">
                      <PlusSquare className="w-4 h-4 text-primary" />
                    </div>

                    <p className="text-xs text-zinc-700 dark:text-zinc-300">
                      2. Tap <strong>Add to Home Screen</strong>.
                    </p>

                  </div>

                  <button
                    onClick={dismiss}
                    type="button"
                    className="w-full mt-1 py-2.5 rounded-xl bg-primary text-white text-xs font-bold cursor-pointer hover:bg-primary/90 active:scale-95 transition-all"
                  >
                    Got it
                  </button>

                </div>
              )}

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
