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
    console.log('1. Registering service worker...');
    const reg = await navigator.serviceWorker.register('/sw.js');
    console.log('2. Service Worker registered:', reg);
    
    console.log('3. Requesting notification permission...');
    const perm = await Notification.requestPermission();
    console.log('4. Permission status:', perm);
    if (perm !== 'granted') {
      status.textContent = 'Izin notifikasi ditolak';
      console.error('Notification permission denied');
      return;
    }

    console.log('5. Fetching VAPID public key...');
    const resp = await fetch('/vapidPublicKey');
    const data = await resp.json();
    const publicKey = data.publicKey;
    console.log('6. VAPID public key:', publicKey.substring(0,20) + '...');

    // debug: check key format
    console.log('6.a Public key raw:', publicKey);
    console.log('6.b Public key length:', publicKey.length);

    console.log('7. Subscribing to push manager...');
    const applicationServerKey = urlBase64ToUint8Array(publicKey);
    console.log('7.a applicationServerKey is Uint8Array?', applicationServerKey instanceof Uint8Array, Object.prototype.toString.call(applicationServerKey));
    try {
      console.log('7.b applicationServerKey byteLength:', applicationServerKey && applicationServerKey.byteLength);
    } catch (e) {
      console.log('7.b could not read byteLength:', e);
    }
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey
    });
    console.log('8. Subscription created:', sub);

    console.log('9. Sending subscription to server...');
    const subResp = await fetch('/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub)
    });
    const subData = await subResp.json();
    console.log('10. Server response:', subData);

    status.textContent = 'Terdaftar untuk notifikasi ❤️';
    console.log('✓ Subscription flow complete');

    // auto-send a welcome notification via server
    try {
      console.log('Sending welcome notification via /sendNow');
      await fetch('/sendNow', { method: 'POST' });
      console.log('Requested /sendNow');
    } catch (e) {
      console.warn('Failed to request /sendNow:', e);
    }
  } catch (err) {
    console.error('Subscription error:', err);
    status.textContent = 'Gagal mendaftar: ' + err.message;
  }
});

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
