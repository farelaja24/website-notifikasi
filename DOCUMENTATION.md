# 📚 Documentation & Setup Guide

## 📖 Dokumentasi File

Saya telah membuat dokumentasi lengkap untuk membantu Anda:

### 1. **QUICK_START.md** ⭐ START HERE!
Panduan cepat step-by-step untuk test notifikasi:
- Setup Windows notification permission
- Clear browser cache
- Test saat browser minimize
- Test saat browser tutup
- Quick troubleshooting checklist

**👉 Baca ini dulu jika Anda baru!**

### 2. **NOTIFICATION_CLOSED_BROWSER_FIX.md**
Dokumentasi teknis lengkap tentang fix untuk notifikasi saat browser tutup:
- Root cause analysis
- Solusi yang diterapkan  
- Windows permission setup (detailed)
- Advanced troubleshooting
- Debug logs reference

**👉 Gunakan ini jika notifikasi masih tidak muncul**

### 3. **FIXES_APPLIED.md**
Ringkasan semua technical changes:
- Service Worker improvements
- Frontend improvements
- Server improvements
- Expected behavior

**👉 Referensi teknis untuk developers**

---

## 🚀 Quick Setup

```powershell
# Terminal 1: Start server
cd c:\Users\ROBINW\Documents\website_notifikasi
npm install  # if not done already
node server.js

# Terminal 2 (optional): Run tests
node advanced-test.js
```

## ✅ Checklist Untuk Notifikasi Kerja

- [ ] Windows Notifications enabled di Settings
- [ ] Browser notification permission = Allow
- [ ] Browser cache sudah dihapus (Ctrl+Shift+Delete)
- [ ] Service Worker sudah registered (lihat di DevTools → Application)
- [ ] Subscribe done (status "Terdaftar untuk notifikasi ❤️")
- [ ] Server log show "[PUSH] ✓ Sent successfully"

## 🧪 Test Scenarios

### Scenario 1: Browser Open ✅
```
Expected: Notification appears immediately
How to test: Run server, open http://localhost:3000, click "Izinkan Notifikasi"
```

### Scenario 2: Browser Minimize ✅  
```
Expected: Notification still appears in notification center
How to test: Minimize window, wait 10s, check notification area
```

### Scenario 3: Browser Closed ⭐
```
Expected: Notification appears in Windows notification center
How to test: Close browser completely, wait 10s, check notification area
Important: Must have Windows notification permission enabled!
```

## 📊 Files Changed

Following files were modified to fix the issue:

1. **public/sw.js** - Service worker
   - Added 3-layer fallback for showNotification
   - Added detailed logging
   - Improved error handling
   - Added message event listener

2. **public/app.js** - Frontend JavaScript
   - Added updateViaCache option
   - Better permission checking
   - Periodic update checks
   - Controller health checks

3. **server.js** - Backend Node.js
   - Added retry mechanism (2x retries)
   - Added /health endpoint
   - Better logging
   - Improved error tracking

## 🔍 Debug Commands

```bash
# Check server health
curl http://localhost:3000/health

# See all subscriptions
curl http://localhost:3000/subscriptions

# Detailed subscription info
curl http://localhost:3000/debug/subscriptions

# Manually trigger notification
curl http://localhost:3000/debug/test-send
```

## 📱 Testing Scripts

```bash
# Basic test script
node test-notifications.js

# Advanced test script with detailed checks
node advanced-test.js
```

## 🛠️ Troubleshooting Flow

```
1. Notification muncul saat browser open?
   → YES: Continue ke step 2
   → NO: Check browser console (F12), lihat error

2. Notification muncul saat browser minimize?
   → YES: Continue ke step 3
   → NO: Check service worker installation

3. Notification muncul saat browser closed?
   → YES: ✅ Everything works!
   → NO: Check Windows notifications settings
   
4. Masih tidak muncul?
   → Baca NOTIFICATION_CLOSED_BROWSER_FIX.md
   → Follow troubleshooting section
```

## 🎯 Expected Behavior Setelah Fix

| Skenario | Sebelum Fix | Sesudah Fix |
|----------|------------|-----------|
| Browser Open | ✅ Muncul | ✅ Muncul |
| Browser Minimize | ❌ Tidak | ✅ Muncul |
| Browser Closed | ❌ Tidak | ✅ Muncul (jika OS perm ok) |

## ⚙️ Key Improvements Made

### Service Worker (sw.js)
```javascript
// Before: Simple try-catch
// After: 3-layer fallback + detailed logging

event.waitUntil(
  self.registration.showNotification(title, opts)
    .then(() => { /* success */ })
    .catch(err => { /* fallback 1 */ })
    // cascade to fallback 2, fallback 3...
)
```

### Frontend (app.js)
```javascript
// Before: Basic registration
// After: updateViaCache + periodic checks + health checks

const reg = await navigator.serviceWorker.register('/sw.js', {
  scope: '/',
  updateViaCache: 'none'  // Always check for updates
});
```

### Server (server.js)
```javascript
// Before: Single send attempt
// After: Automatic retry on network errors

async function sendNotification(sub, payload, retryCount = 0) {
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload));
  } catch (err) {
    if (retryCount < MAX_RETRIES) {
      // Retry after 2 seconds
    }
  }
}
```

## 🔐 Permission Levels Required

### Browser Level
- Chrome: Settings → Privacy → Notifications → localhost:3000 → Allow
- Firefox: Preferences → Privacy → Permissions → Notifications → Allow localhost
- Edge: Settings → Privacy → Notifications → localhost:3000 → Allow

### OS Level (Windows)
- Settings → System → Notifications & actions → Chrome/Edge → ON
- Settings → Focus assist → Set to "Off" or "Priority only"

## ✉️ Message Format

Notifications are sent with this format:

```javascript
{
  title: "Notifikasi Sayang 💌",
  body: "Your message here",
  // Options
  requireInteraction: true,  // Persist until user acts
  vibrate: [200, 100, 200],
  icon: "/icon.png",
  badge: "/icon.png",
  tag: "notification-sayang"  // Groups notifications
}
```

## 📝 Log Format Reference

```
[SEND]  - Main send loop
[PUSH]  - Push notification send attempt
[SW]    - Service worker lifecycle
[SW Push] - Service worker push event handling
```

Example successful log:
```
[SEND] Delivering to subscription 1/4...
[PUSH] Sending to: https://fcm.googleapis.com/...
[PUSH] Payload: "SAYANGGG JANGAN LUPA..."
[PUSH] ✓ Sent successfully
```

## 🌐 Browser Compatibility

| Browser | Desktop | Mobile | Notes |
|---------|---------|--------|-------|
| Chrome | ✅ | ✅ | Best support |
| Firefox | ✅ | ✅ | Good support |
| Safari | ❌ | ❌ | No service worker push |
| Edge | ✅ | ✅ | Chromium-based |

## 🆘 Getting Help

1. Check **QUICK_START.md** first
2. If issue persists, check **NOTIFICATION_CLOSED_BROWSER_FIX.md**
3. Run `node advanced-test.js` for automated diagnostics
4. Check DevTools → Application → Service Workers for SW status
5. Check DevTools → Console for errors

---

## 📞 Quick Reference

**Server not running?**
```powershell
node server.js
```

**Port already in use?**
```powershell
# Change port
$env:PORT = 3001
node server.js
```

**Clear all subscriptions?**
- Delete `subscriptions.json` file
- Re-subscribe on http://localhost:3000

**Reset service worker?**
- DevTools → Application → Service Workers → Unregister
- Hard refresh: Ctrl+Shift+Delete
- Clear "Cookies and site data"
- Reload page

---

**version:** 2.0 (Fixed closed browser notifications)
**Last Updated:** February 14, 2026
**Status:** Ready for production testing
