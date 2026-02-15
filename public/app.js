function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const status = document.getElementById('status');
const btn = document.getElementById('enable');
const disableBtn = document.getElementById('disable');

btn.addEventListener('click', async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    status.textContent = 'Browser tidak mendukung Push API';
    console.error('Service Worker atau Push API tidak disuports');
    return;
  }

  try {
    console.log('\n========== SUBSCRIPTION FLOW START ==========');
    console.log('1. Registering service worker...');
    const reg = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none'
    });
    console.log('2. ✓ Service Worker registered:', reg);
    
    console.log('3. Requesting notification permission...');
    const perm = await Notification.requestPermission();
    console.log('4. Permission status:', perm);
    
    if (perm !== 'granted') {
      status.textContent = 'Izin notifikasi ditolak';
      console.error('❌ Notification permission denied');
      alert('⚠️ Silakan izinkan notifikasi di settings browser Anda:\n\n' +
            'Chrome: Menu > Settings > Privacy > Notifications > Add site\n' +
            'Firefox: Preferences > Privacy > Permissions > Notifications\n' +
            'Edge: Settings > Privacy > Website Permissions > Notifications');
      return;
    }
    
    // Verify permission in Notification API
    console.log('5. Notification.permission:', Notification.permission);

    console.log('6. Fetching VAPID public key...');
    const resp = await fetch('/vapidPublicKey');
    const data = await resp.json();
    const publicKey = data.publicKey;
    console.log('7. ✓ VAPID public key retrieved');

    console.log('8. Subscribing to push manager...');
    const applicationServerKey = urlBase64ToUint8Array(publicKey);
    
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey
    });
    console.log('9. ✓ Subscription created');
    console.log('   Endpoint:', sub.endpoint.substring(0, 60) + '...');

    console.log('10. Sending subscription to server...');
    // Include device timezone metadata so server can schedule per-user
    const tzOffsetMinutes = new Date().getTimezoneOffset();
    const tzName = (Intl && Intl.DateTimeFormat) ? Intl.DateTimeFormat().resolvedOptions().timeZone : null;
    const subWithMeta = Object.assign({}, sub, { tzOffsetMinutes, tz: tzName });
    const subResp = await fetch('/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subWithMeta)
    });
    const subData = await subResp.json();
    console.log('11. ✓ Server confirmed subscription');

    status.textContent = 'Terdaftar untuk notifikasi ❤️';
    console.log('========== SUBSCRIPTION FLOW COMPLETE ==========\n');

    // Register background sync for reliability
    try {
      if ('sync' in reg) {
        await reg.sync.register('sync-notifications');
        console.log('✓ Background sync registered');
      }
    } catch (err) {
      console.warn('⚠️ Background sync not available:', err.message);
    }

    // Send welcome notification
    try {
      console.log('Sending welcome notification via /sendWelcome');
      await fetch('/sendWelcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub)
      });
      console.log('✓ Requested /sendWelcome - welcome notification should arrive');
    } catch (e) {
      console.warn('⚠️ Failed to request /sendWelcome:', e);
    }

    // Start a simple client-side scheduler that will:
    // - show a local welcome + one random immediately
    // - then check device time each minute and show scheduled messages at hour:00
    // - otherwise show random at :00 and :30
    startClientScheduler(sub).catch(err => console.warn('Client scheduler failed to start:', err));
  } catch (err) {
    console.error('❌ Subscription error:', err);
    status.textContent = 'Gagal mendaftar: ' + err.message;
  }
});

// -------------------------
// Client-side scheduler
// -------------------------
async function showNotificationViaSW(title, body) {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg && reg.showNotification) {
      reg.showNotification(title, { body });
    } else if (window.Notification) {
      new Notification(title, { body });
    }
  } catch (e) {
    console.warn('showNotificationViaSW failed:', e);
  }
}

function msUntilNextMinute() {
  const now = new Date();
  return 60000 - (now.getSeconds() * 1000 + now.getMilliseconds());
}

async function startClientScheduler(subscription) {
  if (Notification.permission !== 'granted') return;

  // Fetch scheduled mapping from server
  let scheduled = {};
  try {
    const resp = await fetch('/scheduled');
    const j = await resp.json();
    if (j && j.scheduledMessages) scheduled = j.scheduledMessages;
  } catch (e) {
    console.warn('Could not fetch scheduled mapping from server, using defaults');
  }


  // Helper to pick random message
  const pickRandom = () => randomMessages[Math.floor(Math.random() * randomMessages.length)];

  // Immediately show a welcome (local) and one random

  // Track last shown minute to avoid duplicates
  let lastMessageMinute = -1;
  let lastScheduledHourShown = -1;

  // Start periodic checks aligned to next minute
  setTimeout(() => {
    const tick = async () => {
      if (Notification.permission !== 'granted') return;
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();

      const thisMinuteId = hour * 60 + minute;
      if (lastMessageMinute === thisMinuteId) return; // already processed
      lastMessageMinute = thisMinuteId;

      // If it's top of the hour and there's a scheduled message for this hour
      if (minute === 0 && scheduled && typeof scheduled[hour] !== 'undefined') {
        // Avoid repeating within same hour
        if (lastScheduledHourShown !== hour) {
          const msg = scheduled[hour] || `Scheduled message for ${hour}:00`;
          await showNotificationViaSW('Notifikasi Jadwal 💫', msg);
          lastScheduledHourShown = hour;
        }
        return;
      }

      // Otherwise, at :00 or :30 show a random message
      if (minute === 0 || minute === 30) {
        await showNotificationViaSW('Notifikasi Sayang 💌', pickRandom());
      }
    };

    // run immediately then every minute
    tick();
    setInterval(tick, 60 * 1000);
  }, msUntilNextMinute());
}

  // Unsubscribe handler
  if (disableBtn) {
    disableBtn.addEventListener('click', async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) {
          alert('Service worker belum terdaftar');
          return;
        }
        const sub = await reg.pushManager.getSubscription();
        if (!sub) {
          alert('Belum ada subscription untuk dibatalkan');
          return;
        }
        const unsubbed = await sub.unsubscribe();
        console.log('Unsubscribed locally:', unsubbed);
        // inform server to remove subscription
        try {
          await fetch('/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sub)
          });
          console.log('Notified server to remove subscription');
        } catch (e) {
          console.warn('Failed to notify server about unsubscribe:', e);
        }
        status.textContent = 'Tidak terdaftar untuk notifikasi';
        alert('Berhasil unsubscribe');
      } catch (e) {
        console.error('Unsubscribe error:', e);
        alert('Gagal unsubscribe: ' + e.message);
      }
    });
  }

// removed test send button — welcome notification is sent automatically after subscribe

// On page load: register service worker and ensure subscription persisted on server
async function initServiceWorkerAndSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    status.textContent = 'Browser tidak mendukung Push API';
    console.error('Service Worker atau Push API tidak didukung');
    return;
  }

  try {
    // Register Service Worker with scope and proper options
    console.log('Init: Registering Service Worker from /sw.js');
    const reg = await navigator.serviceWorker.register('/sw.js', { 
      scope: '/',
      updateViaCache: 'none' // Always check for updates to bypass cache
    });
    console.log('Init: Service Worker registered successfully', reg);
    
    // Check for updates periodically
    setInterval(() => {
      console.log('Init: Checking for Service Worker updates...');
      reg.update().catch(err => {
        console.error('Init: Update check failed:', err);
      });
    }, 3600000); // Check every hour
    
    // Ensure controller is ready
    const controller = navigator.serviceWorker.controller;
    if (!controller) {
      console.log('Init: No active controller, waiting for it...');
      await new Promise(resolve => {
        navigator.serviceWorker.oncontrollerchange = () => {
          console.log('Init: Controller changed');
          resolve();
        };
        setTimeout(() => {
          console.log('Init: Timeout waiting for controller');
          resolve();
        }, 3000);
      });
    }
    
    // Health check the service worker
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const mc = new MessageChannel();
      navigator.serviceWorker.controller.postMessage(
        { type: 'CHECK_SW' },
        [mc.port2]
      );
      
      mc.port1.onmessage = (event) => {
        console.log('Init: SW Health check response:', event.data);
      };
    }
    
    // Check for existing subscription
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      console.log('Init: Found existing subscription:', sub);
      // Ensure server still has it stored
      try {
        const resp = await fetch('/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub)
        });
        const data = await resp.json();
        console.log('Init: Server confirmed subscription:', data);
      } catch (e) {
        console.warn('Init: Could not confirm subscription with server:', e);
      }
      status.textContent = 'Terdaftar untuk notifikasi ❤️';
      console.log('✓ Existing subscription is active');
    } else {
      console.log('Init: No existing subscription found');
      status.textContent = 'Belum terdaftar';
    }
    
    // Attempt to register background sync (if supported)
    if ('sync' in reg) {
      try {
        await reg.sync.register('sync-notifications');
        console.log('Init: Background sync registered');
      } catch (err) {
        console.warn('Init: Background sync not available:', err);
      }
    }
    
  } catch (e) {
    console.error('Init: Service Worker registration failed:', e);
    status.textContent = 'Error - ' + (e.message || 'unknown error');
  }
}

// ============================================
// Time Synchronization with Server
// ============================================
// Send device time to server periodically so it can sync with client
async function syncDeviceTime() {
  try {
    const deviceTime = Date.now();
    const resp = await fetch('/sync-time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceTime })
    });
    const data = await resp.json();
    
    const timeDriftMs = data.timeDrift;
    const timeDriftSec = (timeDriftMs / 1000).toFixed(2);
    
    console.log(`[TIME-SYNC] Device time: ${new Date(deviceTime).toISOString()}`);
    console.log(`[TIME-SYNC] Server time: ${new Date(data.serverTime).toISOString()}`);
    console.log(`[TIME-SYNC] Time drift: ${timeDriftSec}s (${timeDriftMs}ms)`);
    console.log(`[TIME-SYNC] Next scheduled in: ${Math.ceil(data.nextScheduledIn / 1000)}s`);
    console.log(`[TIME-SYNC] Next random in: ${Math.ceil(data.nextRandomIn / 1000)}s`);
    
    if (Math.abs(timeDriftMs) > 5000) {
      console.warn(`[TIME-SYNC] ⚠️  Large time drift detected: ${timeDriftSec}s`);
    }
  } catch (err) {
    console.warn('[TIME-SYNC] Failed to sync time with server:', err.message);
  }
}

// Periodically sync device time (every 30 seconds)
setInterval(syncDeviceTime, 30 * 1000);
// Also sync immediately on page load
syncDeviceTime().catch(err => {
  console.warn('Initial time sync failed (may retry later):', err);
});

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initServiceWorkerAndSubscription);
} else {
  initServiceWorkerAndSubscription();
}

// -------------------------
// PWA install prompt handling
// -------------------------
let deferredInstallPrompt = null;
const installBtn = document.getElementById('install');
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (installBtn) {
    installBtn.style.display = 'inline-block';
    installBtn.addEventListener('click', async () => {
      installBtn.style.display = 'none';
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      console.log('PWA install choice:', choice);
      deferredInstallPrompt = null;
    });
  }
});

window.addEventListener('appinstalled', () => {
  console.log('PWA installed');
  if (installBtn) installBtn.style.display = 'none';
});
