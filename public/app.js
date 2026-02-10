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
const testBtn = document.getElementById('testSend');

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

    console.log('7. Subscribing to push manager...');
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
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
  } catch (err) {
    console.error('Subscription error:', err);
    status.textContent = 'Gagal mendaftar: ' + err.message;
  }
});

if (testBtn) {
  testBtn.addEventListener('click', async () => {
    try {
      console.log('Clicking test send button...');
      const resp = await fetch('/sendNow', { method: 'POST' });
      const data = await resp.json();
      console.log('Server response:', data);
      alert('Kirim sekarang: ' + (data.sent ? 'OK' : 'Gagal') + ' (lihat console untuk detail)');
    } catch (e) {
      console.error('Test send error:', e);
      alert('Gagal menghubungi server: ' + e.message);
    }
  });
}
