self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
  console.log('[SW] Push received raw:', event.data?.text());

  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch (e) {
    console.error('[SW] JSON parse failed, using fallback:', e);
    data = {
      title: 'Reminder',
      body: event.data?.text() ?? 'You have a new notification',
    };
  }

  const options = {
    body: data.body,
    icon: '/icon.png', // your app icon
    badge: '/badge.png', // small badge icon
    vibrate: [200, 100, 200, 100, 200], // vibration pattern (mobile)
    requireInteraction: true, // stays until user dismisses it (no auto-close)
    silent: false, // allow sound
    tag: 'wsr-reminder', // replaces previous notification instead of stacking
    renotify: true, // plays sound/vibrate even if same tag
    actions: [
      { action: 'submit', title: '📋 Submit Now' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(
    self.registration
      .showNotification(data.title, options)
      .then(() => console.log('[SW] Notification shown successfully'))
      .catch((err) => console.error('[SW] showNotification error:', err)),
  );
});

// Handle action button clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'submit') {
    event.waitUntil(clients.openWindow('/weekly-status-report'));
  }
});
