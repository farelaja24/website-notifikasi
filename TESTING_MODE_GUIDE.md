# Testing Mode Configuration - Balikpapan (WITA)

## Current Settings (TESTING MODE)

Your server is now configured for **TESTING** to verify all notifications work:

### 1. **Timezone: Balikpapan (WITA - UTC+8)**
- Default `TIMEZONE_OFFSET = 8` in `server.js`
- Server will use your local Balikpapan time

### 2. **Random Messages: Every 20 seconds**
- Changed from 30 minutes → 20 seconds (in `TEST_INTERVAL_SECONDS`)
- You'll see random messages VERY frequently
- To change: Set env var `TEST_INTERVAL_SECONDS=1200` (20 minutes in seconds)

### 3. **Scheduled Messages: Every 60 seconds (for current hour)**
- Changed from once/hour (at :00) → every 60 seconds
- Guard time: `60 * 1000` (60 seconds)
- You'll see scheduled messages repeat every minute
- To change back to production: change `60 * 1000` → `60 * 60 * 1000`

## Testing Flow

1. **Open website** and enable notifications
2. **Keep browser open** — you should see:
   - Random message every 20 seconds
   - Scheduled message every 60 seconds (for current hour)
3. **Close browser** — check if notifications appear on your system tray/phone

## Server Log Example
```
[SEND] ========================================
[SEND] Time: 14:23:45 (14:23:45)    ← Your Balikpapan time
[SEND] Type: ⭐ SCHEDULED (TESTING: every 60 sec)
[SEND] Message: "JANGAN LUPAA MAMM YAK..."
[SEND] Recipients: 5
[SEND] ========================================
```

## Revert to Production (IMPORTANT)

When testing is done, **REVERT to production settings**:

### In `server.js`:

**Line ~500:** Change test interval
```javascript
// From:
const testIntervalSec = parseInt(process.env.TEST_INTERVAL_SECONDS || '20', 10);
// To:
const testIntervalSec = parseInt(process.env.TEST_INTERVAL_SECONDS || '1800', 10); // 30 min
```

**Line ~390:** Change scheduled message guard
```javascript
// From:
if (nowMs - lastScheduledSentAt > 60 * 1000) { // TESTING: 60 seconds
// To:
if (nowMs - lastScheduledSentAt > 60 * 60 * 1000) { // PRODUCTION: 1 hour
```

**Line ~392:** Update message type string
```javascript
// From:
msgType = '⭐ SCHEDULED (TESTING: every 60 sec)';
// To:
msgType = '⭐ SCHEDULED';
```

**Line ~397:** Update console log
```javascript
// From:
console.log(`[SEND] >>> SCHEDULED MESSAGE TIME! Hour: ${hour} (TESTING MODE: every minute) <<<`);
// To:
console.log(`[SEND] >>> SCHEDULED MESSAGE TIME! Hour: ${hour}:00 <<<`);
```

### Then redeploy:
```bash
git add server.js
git commit -m "Revert testing mode to production settings"
git push  # Auto-deploys to Railway
```

## Troubleshooting

### Notifications not showing on phone/desktop while browser is open?
- Check Android/Windows notification permission settings (separate from browser settings)
- Android: Settings → Apps → Chrome → Notifications → Allow
- Windows: Settings → System → Notifications → Check app is allowed

### Scheduled messages not appearing?
- Run: `node test-railway-scheduled.js <your-railway-url> 13`
- Check `[SCHEDULER]` and `[SEND]` log lines
- Verify timezone is correct: `[INIT] Timezone offset: UTC+8`

### Still getting UTC timezone on Railway?
- Check env variables in Railway dashboard: `TIMEZONE_OFFSET=8`
- If set, redeploy to apply changes

## Files Modified for Testing
- `server.js` — lines 50-58, 390-440, 500, 620-650
- Created: `test-railway-scheduled.js` — debug script
- Created: `RAILWAY_TIMEZONE_FIX.md` — timezone guide
