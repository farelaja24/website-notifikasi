# Railway Timezone Configuration Guide

## Problem
Your Railway deployment is using **UTC timezone** while your local time is **WIB (UTC+7)**. This causes scheduled messages to send at the wrong time because the server thinks it's a different hour than your local time.

**Example:**
- Your local time: 13:00 (1 PM)
- Server time: 06:00 (6 AM) — 7 hours behind!
- Scheduled message for 13:00 won't trigger until server reaches 13:00 UTC (which is 20:00 your time)

## Solution: Set TIMEZONE_OFFSET Environment Variable

### Steps:

1. **Go to your Railway dashboard** for your project
2. **Navigate to** Variables tab
3. **Add new variable:**
   ```
   TIMEZONE_OFFSET = 7
   ```
   (Use +7 for WIB, -5 for EST, -8 for PST, etc.)

4. **Redeploy** your project so the new env var takes effect

### Timezone Offsets Reference:
- **WIB (Indonesia):** `7`
- **EST (US Eastern):** `-5`
- **CST (US Central):** `-6`
- **MST (US Mountain):** `-7`
- **PST (US Pacific):** `-8`
- **GMT/UTC:** `0`
- **IST (India):** `5.5` (or `5` for simpler setup)
- **JST (Tokyo):** `9`
- **AEST (Sydney):** `10` or `11` (depending on daylight saving)

### How It Works:
When you set `TIMEZONE_OFFSET=7`, the server will calculate the current local time as:
```
Local Time = UTC Time + 7 hours
```

So even though Railway servers run in UTC, the scheduling logic will use your local timezone to determine when to send messages.

## Verify the Fix:

After setting the env var and redeploying, run:
```bash
node test-railway-scheduled.js https://website-notifikasi-production-6c01.up.railway.app 13
```

You should see:
- Server time with correct local hour (e.g., 13:03 not 06:03)
- Timezone offset displayed: `7`
- Scheduled messages firing at the expected local hour

## For Android/Phone Notifications Not Showing

Even after fixing the timezone, notifications might not show on Android when the browser is closed. This is because:

1. **Browser background tasks:** Chrome/Firefox on Android may not keep push service workers active when the browser is fully closed
2. **Android notification settings:** Your device may have blocked notifications for the browser
3. **OS battery optimization:** Android may be aggressively killing background processes

### Fix checklist:
- [ ] Go to **Android Settings → Apps → Chrome (or Firefox)**
- [ ] Ensure **Notifications** is enabled
- [ ] Check **Battery optimization** — add Chrome to "Not optimized" list
- [ ] Check **Permissions → Notifications** is allowed
- [ ] Check **Background restriction** is not enabled
- [ ] Try in a different browser (Firefox, Edge) to see if it's Chrome-specific

## More Information:
- See `NOTIFICATION_CLOSED_BROWSER_FIX.md` for Windows/desktop browser behavior
- See `DOCUMENTATION.md` for general architecture
