console.log('[SW] Service Worker installed');

self.addEventListener('push', function(event) {
  console.log('[SW Push Event] Received:', event);
  
  let data = { title: 'Hai', body: 'Kamu punya pesan :)' };
  if (event.data) {
    try {
      data = event.data.json();
      console.log('[SW Push] Parsed JSON:', data);
    } catch (e) {
      data.body = event.data.text();
      console.log('[SW Push] Text body:', data.body);
    }
  }
  
  const opts = {
    body: data.body,
    icon: '/icon.png',
    badge: '/icon.png',
    tag: 'notification',
    requireInteraction: false,
    vibrate: [200, 100, 200]
  };
  
  console.log('[SW Push] Showing notification:', data.title, opts);
  event.waitUntil(
    self.registration.showNotification(data.title, opts)
      .then(() => console.log('[SW Push] Notification shown successfully'))
      .catch(err => console.error('[SW Push] Failed to show notification:', err))
  );
});

self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Notification clicked:', event.notification.title);
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(function(clientList) {
      if (clientList.length > 0) {
        console.log('[SW] Focusing existing window');
        return clientList[0].focus();
      }
      console.log('[SW] Opening new window');
      return clients.openWindow('/');
    })
  );
});

self.addEventListener('notificationclose', function(event) {
  console.log('[SW] Notification closed:', event.notification.title);
});
