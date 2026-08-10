// Remove all service workers so they never serve stale content.
// This app requires network (AI API), so offline caching is unnecessary.
// PWA manifest stays active for "Add to Home Screen" experience.

if ('serviceWorker' in navigator) {
  (async () => {
    const hadController = !!navigator.serviceWorker.controller;
    const registrations = await navigator.serviceWorker.getRegistrations();

    if (registrations.length > 0) {
      await Promise.all(registrations.map(r => r.unregister()));
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }

    // If an old SW was controlling this page, reload once to escape its grip.
    // After reload, no SW runs → every visit fetches fresh content from network.
    if (hadController) {
      window.location.reload();
    }
  })();
}
