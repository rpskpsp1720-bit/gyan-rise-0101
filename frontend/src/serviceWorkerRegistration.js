/**
 * Register the GYAN RISE service worker.
 *
 * - Only enabled on HTTPS (or localhost) in production builds.
 * - Logs registration scope so we can confirm in DevTools.
 * - Notifies the app of waiting updates so we can prompt the user to refresh.
 */

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  const isLocalhost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '[::1]';

  const isHttps = window.location.protocol === 'https:';

  // Only register on production-grade origins.
  if (!isHttps && !isLocalhost) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js', { scope: '/' })
      .then((reg) => {
        // eslint-disable-next-line no-console
        console.info('[PWA] Service worker registered. scope=', reg.scope);

        // If a new SW is waiting, ask it to activate immediately.
        if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING');

        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available — apply on next nav.
              // eslint-disable-next-line no-console
              console.info('[PWA] Update ready. Refresh to apply.');
            }
          });
        });
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[PWA] Service worker registration failed:', err);
      });

    // Reload the page once when the active SW changes (after SKIP_WAITING).
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}
