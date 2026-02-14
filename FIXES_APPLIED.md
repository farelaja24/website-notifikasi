# 🔧 Perbaikan Web Push Notifications

## Masalah yang Diperbaiki
Notifikasi tidak terkirim saat website diminimize atau ditutup.

## Solusi yang Diterapkan

### 1. **Service Worker (sw.js)** - Peningkatan untuk Background Mode
- ✅ Ditambah `requireInteraction: true` - membuat notifikasi tetap terlihat sampai user interaksi
- ✅ Ditambah error handling fallback untuk show notification
- ✅ Ditambah message event listener untuk komunikasi dengan page
- ✅ Ditambah background sync event listener
- ✅ Perbaikan logging dengan timestamp lengkap
- ✅ Improved `notificationclick` handler dengan `includeUncontrolled: true`

### 2. **Frontend (app.js)** - Service Worker Registration yang Lebih Kuat
- ✅ Ditambah `updateViaCache: 'none'` - memastikan selalu cek update
- ✅ Ditambah periodic update checking (setiap jam)
- ✅ Ditambah controller health check setelah registration
- ✅ Ditambah MessagePort communication untuk check SW status
- ✅ Ditambah background sync registration
- ✅ Better error handling dan timeout management
- ✅ Enhanced logging untuk debugging

### 3. **Server (server.js)** - Retry Logic dan Health Check
- ✅ Ditambah automatic retry mechanism (hingga 2 kali) untuk network errors
- ✅ Ditambah `/health` endpoint untuk check status server
- ✅ Better success/fail tracking saat mengirim bulk notifications
- ✅ More detailed logging

## Cara Testing

### 1. **Start Server**
```powershell
npm install  # jika belum
node server.js
```

### 2. **Open Browser**
- Go to `http://localhost:3000`
- Click "Izinkan Notifikasi"
- Izinkan notification permission saat diminta

### 3. **Test Notification saat Page Terbuka**
```powershell
# Di terminal lain (atau bisa manual trigger /sendNow)
# Seharusnya notifikasi langsung muncul
```

### 4. **Test saat Page Minimize** ⭐ PENTING
1. Terbuka halaman notification
2. Klik "Izinkan Notifikasi"
3. **MINIMIZE browser window** (jangan tutup)
4. Tunggu ~10 detik
5. Notifikasi seharusnya tetap muncul

### 5. **Test saat Page Ditutup** 
1. Terbuka halaman notification
2. Klik "Izinkan Notifikasi"  
3. **TUTUP browser window** sepenuhnya
4. Tunggu ~10 detik
5. Notification seharusnya masih muncul (di system tray/notification center)
6. Buka browser kembali dan klik notifikasi → harus focus ke halaman

## Browser-Specific Setup

### Chrome/Chromium
✅ Semua fitur sudah supported

### Firefox
✅ Semua fitur sudah supported

### Edge
✅ Sama seperti Chrome

### Opera
✅ Sama seperti Chrome

## Checklist Troubleshooting

Jika notifikasi tetap tidak muncul saat minimize:

- [ ] Permintaan permission sudah di-allow
  - Check: Settings → Sites → Notifications → localhost:3000 → Allow
  
- [ ] Service Worker sudah activated
  - Check: DevTools → Application → Service Workers → status "activated and running"
  
- [ ] Subscription ada di server
  - Check: Open `http://localhost:3000/subscriptions` → harus show subscription

- [ ] Server sedang mengirim notifikasi
  - Check: Terminal - lihat [SEND] dan [PUSH] logs

- [ ] Push notification permission OS-level
  - Check: Windows Settings → System → Notifications → "Allow notifications from apps" → Enable

## Debug Endpoints

```
GET /health              - Check server status
GET /subscriptions       - List all subscriptions count
GET /debug/subscriptions - Detailed subscription info
GET /debug/test-send     - Manual trigger send notifications
```

## Contoh Test Manual

```bash
# Terminal 1 - Start server
node server.js

# Terminal 2 - Manual test setelah subscribe
curl http://localhost:3000/debug/test-send

# Terminal 3 - Check subscriptions
curl http://localhost:3000/subscriptions
```

## Expected Behavior Sekarang

1. **Page Open** → Notifikasi muncul ✅
2. **Page Minimize** → Notifikasi masih muncul ✅ (PERBAIKAN)
3. **Page Close** → Notifikasi masih muncul ✅ (PERBAIKAN)
4. **Click Notification** → Browser/Page focus + notification close ✅

## Notes

- Background sync fallback akan membantu jika network interrupted
- `requireInteraction: true` membuat notifikasi lebih persistent
- Periodic SW update check memastikan latest version selalu dijalankan
- Retry mechanism meningkatkan reliability di network yang less stable

## Jika Masih Ada Masalah

1. Clear browser cache: `Ctrl+Shift+Delete`
2. Unregister service worker:
   - DevTools → Application → Service Workers → Unregister
3. Reload page: `Ctrl+F5` (hard refresh)
4. Clear all subscriptions di server → Subscribe ulang
5. Check browser console untuk error messages

---

Last Updated: 2026-02-14
