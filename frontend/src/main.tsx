import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from './store'
import './index.css'
import App from './App.tsx'

// Disable inspect options (context menu and keyboard shortcuts) if running as a standalone PWA
if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) {
  document.addEventListener('contextmenu', event => event.preventDefault());
  document.addEventListener('keydown', event => {
    // Disable F12
    if (event.key === 'F12' || event.keyCode === 123) {
      event.preventDefault();
    }
    // Disable Ctrl+Shift+I, J, C (Windows) or Cmd+Option+I, J, C (Mac)
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && 
        ['I', 'i', 'J', 'j', 'C', 'c'].includes(event.key)) {
      event.preventDefault();
    }
    // Disable Ctrl+U or Cmd+U (View Source)
    if ((event.ctrlKey || event.metaKey) && ['U', 'u'].includes(event.key)) {
      event.preventDefault();
    }
  });
}

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
