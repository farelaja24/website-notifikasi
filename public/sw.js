// Service Worker lifecycle
console.log('[SW] Service Worker script loaded at:', new Date().toISOString());

self.addEventListener('install', function(event) {
  console.log('[SW] Install event');
  // Skip waiting to activate immediately - important for push notifications
  event.waitUntil(self.skipWaiting().then(() => {
    console.log('[SW] Service Worker skipped waiting');
  }));
});

self.addEventListener('activate', function(event) {
  console.log('[SW] Activate event');
  // Claim all clients immediately - ensures this SW handles all pages
  event.waitUntil(self.clients.claim().then(() => {
    console.log('[SW] Service Worker claimed all clients');
  }));
});

// Handle incoming push notifications
self.addEventListener('push', function(event) {
  const receivedTime = new Date().toISOString();
  console.log('[SW] ============ PUSH EVENT START ============');
  console.log('[SW] Push event received at:', receivedTime);
  console.log('[SW] Event exists:', !!event);
  console.log('[SW] Event.data exists:', !!event.data);
  
  let data = { 
    title: 'Notifikasi Sayang 💌', 
    body: 'Kamu punya pesan :)' 
  };
  
  // Parse incoming push data
  if (event.data) {
    try {
      const jsonData = event.data.json();
      data = jsonData;
      console.log('[SW Push] ✓ Successfully parsed JSON:', data);
    } catch (e) {
      console.warn('[SW Push] JSON parse failed, trying text:', e.message);
      try {
        const textData = event.data.text();
        data.body = textData;
        console.log('[SW Push] ✓ Successfully parsed as text:', data.body);
      } catch (e2) {
        console.error('[SW Push] Text parse also failed:', e2.message);
        // Fallback to default data
        data.body = 'Pesan baru dari Sayang 💌';
        console.log('[SW Push] Using default body:', data.body);
      }
    }
  } else {
    console.warn('[SW Push] ⚠️ No data in push event - using default message');
  }
  
  const title = data.title || 'Notifikasi Sayang 💌';
  const body = data.body || 'Kamu punya pesan :)';
  
  console.log('[SW Push] Final title:', title);
  console.log('[SW Push] Final body:', body);
  
  // Notification options with persistence
  const opts = {
    body: body,
    icon: '/icon.png',
    badge: '/icon.png',
    tag: 'notification-sayang',
    requireInteraction: true, // CRITICAL: Keep notification visible until user interacts
    vibrate: [200, 100, 200],
    silent: false, // IMPORTANT: Make sure sound plays
    actions: [
      { action: 'open', title: 'Buka' }
    ],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
      timestamp: receivedTime
    }
  };
  
  console.log('[SW Push] Notification options:', JSON.stringify(opts, null, 2));
  console.log('[SW Push] Attempting to show notification...');
  
  // Use waitUntil to keep Service Worker alive until notification is shown
  // This is CRITICAL - without this, SW might terminate before notification shows
  const showPromise = self.registration.showNotification(title, opts);
  
  event.waitUntil(
    showPromise
      .then(() => {
        console.log('[SW Push] ✅ NOTIFICATION SHOWN SUCCESSFULLY');
        console.log('[SW] ============ PUSH EVENT END ============\n');
        return true;
      })
      .catch(err => {
        console.error('[SW Push] ❌ FAILED to show notification:', err.message, err.stack);
        console.log('[SW Push] Attempting fallback notification (minimal options)...');
        
        // Fallback 1: Minimal notification
        const fallback1 = self.registration.showNotification(title, {
          body: body,
          tag: 'notification-sayang',
          requireInteraction: true,
          silent: false
        });
        
        return fallback1
          .then(() => {
            console.log('[SW Push] ✅ FALLBACK 1 SUCCESS - Notification shown with minimal options');
            console.log('[SW] ============ PUSH EVENT END ============\n');
            return true;
          })
          .catch(err2 => {
            console.error('[SW Push] ❌ FALLBACK 1 FAILED:', err2.message);
            console.log('[SW Push] Attempting fallback 2 (super minimal)...');
            
            // Fallback 2: Ultra minimal
            const fallback2 = self.registration.showNotification('Notifikasi', {
              body: body || 'Pesan baru',
              tag: 'notification'
            });
            
            return fallback2
              .then(() => {
                console.log('[SW Push] ✅ FALLBACK 2 SUCCESS - Ultra minimal notification shown');
                console.log('[SW] ============ PUSH EVENT END ============\n');
                return true;
              })
              .catch(err3 => {
                console.error('[SW Push] ❌ ALL FALLBACKS FAILED:', err3.message);
                console.error('[SW Push] This is critical - notification could not be shown');
                console.log('[SW] ============ PUSH EVENT END ============\n');
                return false;
              });
          });
      })
  );
  
  console.log('[SW] Push event waitUntil registered, handler will continue async');
});

// Handle notification clicks
self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Notification clicked at:', new Date().toISOString(), 'Title:', event.notification.title);
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // If a window is already open, focus it
      if (clientList.length > 0) {
        console.log('[SW] Found', clientList.length, 'window(s) - focusing first one');
        return clientList[0].focus();
      }
      // Otherwise open a new window
      console.log('[SW] No windows found - opening new window');
      return clients.openWindow('/');
    }).catch(err => {
      console.error('[SW] Error handling notification click:', err);
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', function(event) {
  console.log('[SW] Notification closed at:', new Date().toISOString(), 'Title:', event.notification.title);
});

// Background sync for push messages (fallback mechanism)
// This registers a sync tag that fires periodically
self.addEventListener('sync', function(event) {
  console.log('[SW] Background sync event:', event.tag, 'at:', new Date().toISOString());
  if (event.tag === 'sync-notifications') {
    console.log('[SW] Running notification sync');
  }
});

// Message event - for communication between page and service worker
self.addEventListener('message', function(event) {
  console.log('[SW] Message received at:', new Date().toISOString(), 'Data:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Skip waiting requested');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CHECK_SW') {
    console.log('[SW] Service Worker health check - responding');
    event.ports[0].postMessage({ status: 'active', timestamp: new Date().toISOString() });
  }
});
