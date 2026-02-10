// Service Worker lifecycle
console.log('[SW] Service Worker script loaded');

self.addEventListener('install', function(event) {
  console.log('[SW] Install event');
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('[SW] Activate event');
  // Claim all clients immediately
  event.waitUntil(self.clients.claim());
});

// Handle incoming push notifications
self.addEventListener('push', function(event) {
  console.log('[SW Push Event] Received push:', event);
  
  let data = { 
    title: 'Notifikasi Sayang 💌', 
    body: 'Kamu punya pesan :)' 
  };
  
  // Parse incoming push data
  if (event.data) {
    try {
      data = event.data.json();
      console.log('[SW Push] Parsed JSON:', data);
    } catch (e) {
      try {
        data.body = event.data.text();
        console.log('[SW Push] Parsed as text:', data.body);
      } catch (e2) {
        console.error('[SW Push] Failed to parse data:', e2);
      }
    }
  }
  
  // Notification options
  const opts = {
    body: data.body || 'Pesan baru untukmu',
    icon: '/icon.png',
    badge: '/icon.png',
    tag: 'notification-sayang',
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };
  
  console.log('[SW Push] Attempting to show notification:', data.title, 'body:', data.body);
  
  // Use waitUntil to keep Service Worker alive until notification is shown
  event.waitUntil(
    self.registration.showNotification(data.title || 'Notifikasi Sayang 💌', opts)
      .then(() => {
        console.log('[SW Push] Notification shown successfully');
      })
      .catch(err => {
        console.error('[SW Push] Failed to show notification:', err);
      })
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Notification clicked:', event.notification.title);
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(function(clientList) {
      // If a window is already open, focus it
      if (clientList.length > 0) {
        console.log('[SW] Focusing existing window');
        return clientList[0].focus();
      }
      // Otherwise open a new window
      console.log('[SW] Opening new window');
      return clients.openWindow('/');
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', function(event) {
  console.log('[SW] Notification closed:', event.notification.title);
});
