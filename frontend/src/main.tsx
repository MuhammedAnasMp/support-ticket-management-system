import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from './store'
import './index.css'
import App from './App.tsx'

import { registerSW } from 'virtual:pwa-register'

  // Store the native PWA install prompt
  ; (window as any).__pwaInstallPrompt = null

window.addEventListener('beforeinstallprompt', (event) => {
  console.log('PWA install prompt available')

  // Prevent Chrome from automatically showing its own prompt
  event.preventDefault()

    // Save the event for our Install App button
    ; (window as any).__pwaInstallPrompt = event

  // Tell React that the install prompt is ready
  window.dispatchEvent(
    new Event('pwaInstallReady')
  )
})

window.addEventListener('appinstalled', () => {
  console.log('PWA installed successfully')

    ; (window as any).__pwaInstallPrompt = null
})

registerSW({
  immediate: true,

  onRegisteredSW(swUrl, registration) {
    console.log(
      'Service Worker registered:',
      swUrl
    )

    console.log(
      'Registration:',
      registration
    )
  },

  onRegisterError(error) {
    console.error(
      'Service Worker registration failed:',
      error
    )
  },
})

createRoot(
  document.getElementById('root')!
).render(
  <Provider store={store}>
    <App />
  </Provider>
)
