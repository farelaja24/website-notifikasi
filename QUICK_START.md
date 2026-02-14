# 🚀 QUICK START - Test Notifikasi Saat Browser Ditutup

## Langkah 1: Setup Windows Notification (PENTING!)
```
1. Windows Key + I → Settings
2. System → Notifications & actions
3. Scroll down → Lihat "Google Chrome" atau "Microsoft Edge"
4. Pastikan toggle ON (biru) ✓
5. Close settings
```

## Langkah 2: Clear Browser Cache
```
Chrome: Ctrl + Shift + Delete
Firefox: Ctrl + Shift + Delete
Edge: Ctrl + Shift + Delete

Hapus:
- ☑ Cookies and other site data
- ☑ Cached images and files

Click "Clear data"
```

## Langkah 3: Start Application
```powershell
# Terminal 1: Run server
cd c:\Users\ROBINW\Documents\website_notifikasi
node server.js
```

## Langkah 4: Register untuk Notifications
```
1. Buka browser: http://localhost:3000
2. Klik tombol "Izinkan Notifikasi" (pink button)
3. Dialog muncul → Klik "Allow" atau "Izinkan"
4. Status berubah → "Terdaftar untuk notifikasi ❤️"
5. Tunggu ~3 detik
6. Notifikasi welcome muncul
```

## Langkah 5: Test Saat Browser OPEN
```
Harusnya sudah lihat notifikasi welcome.
Jika ya → Browser open notifications OK ✅
```

## Langkah 6: Test Saat Browser MINIMIZE
```
1. Minimize browser (jangan tutup)
2. Tunggu 10 detik
3. Lihat notification di taskbar atau notification center

Jika muncul ✅ → Minimize test OK
```

## Langkah 7: Test Saat Browser CLOSED ⭐ CRITICAL
```
1. TUTUP browser sepenuhnya
   - Ctrl+W (close tab)
   - Atau close window
   
2. Server masih running di terminal

3. Tunggu 10 detik

4. Lihat notification area:
   - Windows: Bottom right corner
   - Atau: Click clock di taskbar → Lihat notification center
   
5. Harusnya ada notifikasi "Notifikasi Sayang 💌"
```

## Jika Notifikasi TIDAK Muncul Saat Browser Tutup

### Quick Checklist:
```
☐ Windows notification enabled?
   Settings → Notifications & actions → Chrome/Edge ON

☐ Focus Assist tidak block notification?
   Settings → Focus assist → Set ke "Off"

☐ Chrome permission allow?
   Chrome: Menu → Settings → Privacy → Notifications
   Pastikan localhost:3000 di "Allow" list

☐ Server masih running?
   Terminal menunjukkan [SEND] dan [PUSH] logs

☐ Subscription ada di server?
   Open: http://localhost:3000/subscriptions
   Lihat count > 0
```

### Alternative Test (Manual Trigger):
```powershell
# Terminal 2: Trigger notification manually
curl http://localhost:3000/debug/test-send

# Or open di browser:
# http://localhost:3000/debug/test-send
```

## Debug Console Logs (F12)
```
Tekan F12 → Console tab

Cari ini saat push notification dikirim:

❌ BAD:
[SW Push] ❌ FAILED to show notification: ...

✅ GOOD:
[SW Push] ✅ NOTIFICATION SHOWN SUCCESSFULLY
atau
[SW Push] ✅ FALLBACK 1 SUCCESS
```

### Service Worker Logs:
```
F12 → Application → Service Workers
Klik "inspect" link
Buka console
Lihat [SW] dan [PUSH] logs
```

## Success Indicators ✅

Lihat di server log:
```
[SEND] Delivering to subscription 1/1...
[PUSH] Sending to: https://...
[PUSH] ✓ Sent successfully     ← PENTING!
```

Jika ada ✓ Sent successfully, notification sudah dikirim ke browser.
Jika tidak muncul → Windows notification permission problem.

## Final Test Command
```powershell
# Run advanced test (automated testing)
node advanced-test.js
```

---

**Masalah Paling Sering:** Windows Notification Permission Not Enabled

**Solusi:** 
1. Buka Settings
2. System → Notifications & actions  
3. Cari Chrome/Edge → Toggle ON
4. Done!

**Butuh bantuan?** Lihat dokumentasi lengkap:
- `NOTIFICATION_CLOSED_BROWSER_FIX.md` - Detailed troubleshooting
- `FIXES_APPLIED.md` - Technical changes made
