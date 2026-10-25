import { store } from '../store';
import { startApiCall, finishApiCall, resetApiProgress } from '../store/apiProgressSlice';

let isInitialized = false;

/**
 * Checks if a URL represents an API request rather than a static asset or internal bundle file.
 */
function isApiUrl(input: RequestInfo | URL): boolean {
  try {
    let url = '';
    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof Request) {
      url = input.url;
    } else if (input instanceof URL) {
      url = input.href;
    }

    if (!url) return false;

    // Filter out static assets and source maps
    if (/\.(png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot|css|js|map)(\?.*)?$/i.test(url)) {
      return false;
    }

    // Match backend API calls
    if (url.includes('/api/') || url.includes(':8000')) {
      return true;
    }

    // Match relative application API calls, excluding Vite internal scripts
    if (
      url.startsWith('/') &&
      !url.startsWith('/src/') &&
      !url.startsWith('/@') &&
      !url.startsWith('/node_modules/') &&
      !url.startsWith('/manifest.webmanifest')
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Initializes the global API progress tracker by intercepting window.fetch.
 * Automatically increments global activeRequests when an API call starts and
 * decrements it when the request completes or errors out.
 */
export function initApiProgressTracker(): void {
  if (isInitialized || typeof window === 'undefined') {
    return;
  }

  isInitialized = true;
  const originalFetch = window.fetch;

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const track = isApiUrl(input);

    if (track) {
      store.dispatch(startApiCall());
    }

    try {
      const response = await originalFetch.call(window, input, init);
      return response;
    } finally {
      if (track) {
        store.dispatch(finishApiCall());
      }
    }
  };
}

/**
 * Manual triggers if any component wishes to trigger the progress bar directly.
 */
export const notifyApiStart = () => store.dispatch(startApiCall());
export const notifyApiEnd = () => store.dispatch(finishApiCall());
export const resetAllApiProgress = () => store.dispatch(resetApiProgress());
