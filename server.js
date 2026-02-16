// =============================
// TIMEZONE HANDLING (FLEXIBLE)
// =============================

// Server ALWAYS uses UTC
// Timezone configuration
const TIMEZONES = {
  WIB: 7,  // Waktu Indonesia Barat (UTC+7)
  WITA: 8, // Waktu Indonesia Tengah (UTC+8)
  WIT: 9   // Waktu Indonesia Timur (UTC+9)
};

// Default timezone (can be overridden with environment variable)
const DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE || 'WITA';
const DEFAULT_OFFSET = TIMEZONES[DEFAULT_TIMEZONE] || 8;

function convertToUtcHour(localHour, offset = DEFAULT_OFFSET) {
  return (localHour - offset + 24) % 24;
}

function convertToLocalHour(utcHour, offset = DEFAULT_OFFSET) {
  return (utcHour + offset) % 24;
}


const express = require('express');
const bodyParser = require('body-parser');
const webpush = require('web-push');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const fs = require('fs');
const VAPID_FILE = 'vapid.json';

let VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
let VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';

try {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    if (fs.existsSync(VAPID_FILE)) {
      const v = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8'));
      VAPID_PUBLIC = VAPID_PUBLIC || v.publicKey || '';
      VAPID_PRIVATE = VAPID_PRIVATE || v.privateKey || '';
      console.log('Loaded VAPID keys from', VAPID_FILE);
    } else if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      console.log('VAPID keys not found in env or file — generating new keys...');
      const keys = webpush.generateVAPIDKeys();
      VAPID_PUBLIC = keys.publicKey;
      VAPID_PRIVATE = keys.privateKey;
      fs.writeFileSync(VAPID_FILE, JSON.stringify({ publicKey: VAPID_PUBLIC, privateKey: VAPID_PRIVATE }, null, 2));
      console.log('Generated and saved VAPID keys to', VAPID_FILE);
    }
  }
} catch (e) {

    // =============================
    // AUTO PUSH SCHEDULER (5 MENIT)
    // =============================
  console.error('VAPID key handling error:', e);
}

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails('mailto:you@example.com', VAPID_PUBLIC, VAPID_PRIVATE);
  console.log('VAPID configured. Public key length:', VAPID_PUBLIC.length);
} else {
  console.warn('VAPID keys missing; push notifications will not work until configured.');
}

const SUBS_FILE = 'subscriptions.json';
let subscriptions = [];

// Support timezone offset for Railway deployments
// Default: 8 (WITA - Balikpapan/Kalimantan Timur). Set TIMEZONE_OFFSET env var to override.
// WITA = 8, WIB = 7, WIT = 9

const now = new Date();
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
console.log(`[INIT] Server Timezone: ${tz}`);
console.log(`[INIT] Server Local Time: ${now.toLocaleString('en-US', { timeZone: tz, hour12: false })}`);
console.log(`[INIT] Server ISO Time: ${now.toISOString()}`);

// FORCE_SCHEDULED: when true, send scheduled message every minute for testing
// Default: false for production. Set env var FORCE_SCHEDULED=true to enable testing.
const FORCE_SCHEDULED = process.env.FORCE_SCHEDULED ? process.env.FORCE_SCHEDULED === 'true' : false;
console.log('[INIT] FORCE_SCHEDULED =', FORCE_SCHEDULED);

// Try to load subscriptions from env variable first (for Railway persistence)
if (process.env.SUBSCRIPTIONS_DATA) {
  try {
    subscriptions = JSON.parse(process.env.SUBSCRIPTIONS_DATA);
    console.log('Loaded subscriptions from SUBSCRIPTIONS_DATA env var:', subscriptions.length, 'subscriptions');
  } catch (e) {
    console.warn('Failed to parse SUBSCRIPTIONS_DATA env var:', e.message);
  }
}

// If not loaded from env, try to load from file (for local development)
if (subscriptions.length === 0) {
  try {
    if (fs.existsSync(SUBS_FILE)) {
      const raw = fs.readFileSync(SUBS_FILE, 'utf8');
      subscriptions = JSON.parse(raw) || [];
      console.log('Loaded subscriptions from file:', subscriptions.length, 'subscriptions');
    }
  } catch (e) {
    console.error('Failed loading subscriptions file:', e);
  }
}

// Helper to persist subscriptions (both file and env var)
function persistSubscriptions() {
  try {
    fs.writeFileSync(SUBS_FILE, JSON.stringify(subscriptions, null, 2));
    // For Railway: you can manually set SUBSCRIPTIONS_DATA env var from subscriptions.json content
    // Or implement a function to push to Railway config
    console.log('[PERSIST] Saved subscriptions.json (' + subscriptions.length + ' subscriptions)');
  } catch (e) {
    console.error('[PERSIST] Failed to save subscriptions.json:', e.message);
  }
}

app.get('/vapidPublicKey', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC });
});

app.post('/subscribe', (req, res) => {
  const sub = req.body;
  // naive dedupe
  try {
    const exists = subscriptions.find(s => JSON.stringify(s) === JSON.stringify(sub));
    if (!exists) {
      subscriptions.push(sub);
      persistSubscriptions();
      console.log('Saved new subscription (total =', subscriptions.length + ')');
    } else {
      console.log('Subscription already exists');
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Subscribe error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// remove subscription when client unsubscribes
app.post('/unsubscribe', (req, res) => {
  const sub = req.body;
  try {
    const idx = subscriptions.findIndex(s => JSON.stringify(s) === JSON.stringify(sub));
    if (idx !== -1) {
      subscriptions.splice(idx, 1);
      persistSubscriptions();
      console.log('Removed subscription (total =', subscriptions.length + ')');
      return res.json({ success: true });
    }
    console.log('Unsubscribe: subscription not found');
    res.json({ success: false, error: 'not found' });
  } catch (e) {
    console.error('Unsubscribe error', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/subscriptions', (req, res) => {
  res.json({ count: subscriptions.length, subscriptions });
});

// Debug endpoint: show subscription details
app.get('/debug/subscriptions', (req, res) => {
  const details = subscriptions.map((s, i) => ({
    index: i,
    endpoint: s.endpoint.substring(0, 60) + '...',
    endpoint_full: s.endpoint,
    keys: s.keys ? Object.keys(s.keys) : 'none',
    auth: s.keys && s.keys.auth ? s.keys.auth.substring(0, 20) + '...' : 'none',
    p256dh: s.keys && s.keys.p256dh ? s.keys.p256dh.substring(0, 20) + '...' : 'none'
  }));
  res.json({ count: subscriptions.length, details, lastUpdated: new Date().toISOString() });
});

// Health check endpoint for subscribe button
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    vapidConfigured: !!(VAPID_PUBLIC && VAPID_PRIVATE),
    subscriptionCount: subscriptions.length,
    serverUptime: process.uptime()
  });
});

app.get('/debug/test-send', (req, res) => {
  console.log('[DEBUG] Manual test-send triggered');
  sendMessages();
  res.json({ sent: true, timestamp: new Date().toISOString() });
});

// Debug: force-send scheduled message for a specific hour (for testing)
app.get('/debug/send-scheduled/:hour', (req, res) => {
  const hour = parseInt(req.params.hour, 10);
  if (isNaN(hour) || scheduledMessages[hour] === undefined) {
    return res.status(400).json({ success: false, error: 'No scheduled message for that hour' });
  }

  const payload = {
    title: 'Notifikasi Sayang 💌',
    body: scheduledMessages[hour]
  };

  console.log(`[DEBUG] Forcing scheduled message for hour ${hour}`);
  lastScheduledSentAt = Date.now();
  let sent = 0;
  const debugOpts = { TTL: 60 * 60, headers: { Urgency: 'high' } };
  subscriptions.forEach((sub) => {
    sendNotification(sub, payload, debugOpts).then(ok => { if (ok) sent++; });
  });

  res.json({ success: true, triggered: true, hour, recipients: subscriptions.length });
});

// Export subscriptions as env variable format for Railway
app.get('/debug/export-subscriptions', (req, res) => {
  const subsJson = JSON.stringify(subscriptions);
  res.json({
    count: subscriptions.length,
    envVarFormat: `SUBSCRIPTIONS_DATA='${subsJson}'`,
    subscriptionsData: subsJson,
    advice: 'Copy the envVarFormat value and set it as SUBSCRIPTIONS_DATA env var in Railway dashboard'
  });
});

// Debug endpoint: force-send scheduled messages to all subscriptions based on their stored timezone
app.post('/debug/send-scheduled-all', (req, res) => {
  const nowMs = Date.now();
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  subscriptions.forEach(sub => {
    const utcNow = new Date(nowMs);
    const utcHour = utcNow.getUTCHours();
    // Check if current UTC hour matches any scheduled message
    if (scheduledMessages[utcHour]) {
      const payload = { title: 'Notifikasi Sayang 💌', body: scheduledMessages[utcHour] };
      const opts = { TTL: 60 * 60, headers: { Urgency: 'high' } };
      sendNotification(sub, payload, opts).then(ok => {
        if (ok) sent++; else failed++;
      }).catch(() => { failed++; });
    } else {
      skipped++;
    }
  });

  res.json({ success: true, triggeredAt: new Date(nowMs).toISOString(), sentEstimated: sent, skipped, failed });
});

const messages30min = [
  'SAYANGG CANTIK BANGETTTT AAAAAAAA',
  'SAYANGGKUUU GEMESH BANGETTT',
  'SAYANGKUWW CINTAKUWWW UCUK BANGETTTT',
  'SAYANG ADAA YANG DIPIKIRIN TIDAAA, LET ME KNOW YAK CINTAAAA',
  'CHAT ME ANYTIME SAYANGGGGG',
  'I LOVVVVVV UUUUU MOREEEE SAYANGGGG CANTIKKK UCUKKK GEMESHH BAHENOL SEXYYY',
  'I LOVVVVV UUU THE MOST SAYANGGGGG CANTIKKKK',
  '💞💘💞💓💞💓💞💓💘💓💞💓💘💓💓💞💞💓💞',
  'SAYANGGG SEMANGAT HARI INIIII, AKU BAKAL TERUS ADA BUAT SAYANGG GIMANA PUN KONDISINYAAA',
  'SAYANGG JANGAN LUPA TERSENYUM OKEYYYY, AKU SUKAKK NGELIAT SENYUM SAYANGGGG',
  'SAYANGGGG MAW DUNG PAPNYAA AKU KANGENNNN SAYANGGGGG'
];

const scheduledMessagesLocal = {
  7: 'MORNING SAYANGKUW CINTAKUWWW, SEMOGAA HARI INII SAYANGG BISAKK BAHAGIA DAN SENENGGG DAN MOOD SAYANGG TERJAGAA, JANGAN LUPAA MINUM AIR PUTIH DULU YAKKK💘💘💘💘',
  10: 'JANGAN LUPAA MAMM YAK CINTAKUW SAYANGG, BIAR TIDAA KOSONG PEYUTNYAAAAA, SEMANGAT SAYANGGG, CAMAT MAM SAYANGG DAN KENYANGIN CINTAAAAAA DAN JANGAN LUPA MINUM VITAMIN CINTAAA',
  13: 'JANGAN LUPAA MAMM YAK CINTAKUW SAYANGG, BIAR TIDAA KOSONG PEYUTNYAAAAA, SEMANGAT SAYANGGG, CAMAT MAM SAYANGG DAN KENYANGIN CINTAAAAAA DAN JANGAN LUPA MINUM VITAMIN CINTAAA',
  16: 'JANGAN LUPAA MAMM YAK CINTAKUW SAYANGG, BIAR TIDAA KOSONG PEYUTNYAAAAA, SEMANGAT SAYANGGG, CAMAT MAM SAYANGG DAN KENYANGIN CINTAAAAAA DAN JANGAN LUPA MINUM VITAMIN CINTAAA',
  20: 'JANGAN LUPAA MAM YAK SAYANGG KALO SAYANG MASI LAPERR CINTAAAAAA, I LOVVVVVV UUUUU MOREEEE SAYANGGGG',
  22: 'BOBONYA JANGAN TERLALU MALAM YAKK CANTIKKKKKK, SAYANGG JAGA KESEHATANNNNN YAKKKKK',
  23: 'CAMAT BOBO SAYANGGG, JANGAN LUPAA BACAA DOAA SAYANGG, MIMPII INDAHH DANN BOBO YANG NYENYAK SAYANGGG, GUDNAIT SAYANGGG, I LOVVVVVV UUUUU MOREEEE SAYANGGGG CANTIKKK UCUKKK GEMESHH BAHENOL SEXYYY, BABAYY SAYANGGGGG'
};


const scheduledMessages = {};

for (const localHour in scheduledMessagesLocal) {
  const utcHour = convertToUtcHour(Number(localHour));
  scheduledMessages[utcHour] = scheduledMessagesLocal[localHour];
}

console.log(`[INIT] Default timezone: ${DEFAULT_TIMEZONE} (UTC+${DEFAULT_OFFSET})`);
console.log('[INIT] Scheduled messages mapping:');
for (const localHour in scheduledMessagesLocal) {
  const utcHour = convertToUtcHour(Number(localHour));
  console.log(`  Local ${localHour}:00 → UTC ${utcHour}:00`);
}
console.log('[INIT] Scheduled messages (UTC hours):', Object.keys(scheduledMessages).sort((a,b) => a-b));


async function sendNotification(sub, payload, opts = {}, retryCount = 0) {
  const MAX_RETRIES = 2;
  try {
    const endpoint = sub.endpoint || 'unknown';
    console.log(`[PUSH] Sending to: ${endpoint.substring(0, 60)}... (Attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
    console.log(`[PUSH] Payload: "${payload.body.substring(0, 50)}..."`);

    // Defaults: 1 hour TTL and high urgency
    const defaultOpts = { TTL: 60 * 60, headers: { Urgency: 'high' } };
    const sendOpts = Object.assign({}, defaultOpts, opts || {});

    await webpush.sendNotification(sub, JSON.stringify(payload), sendOpts);
    console.log('[PUSH] ✓ Sent successfully');
    return true;
  } catch (err) {
    const status = err && err.statusCode ? err.statusCode : null;
    console.error(`[PUSH] ✗ Failed with status ${status}: ${err.message || JSON.stringify(err)}`);
    if (err && err.body) {
      try {
        console.error('[PUSH] Response body:', err.body.toString());
      } catch (e) {
        console.error('[PUSH] Could not stringify error body');
      }
    }

    // Remove invalid subscriptions (expired or not found)
    if (status === 404 || status === 410) {
      try {
        const idx = subscriptions.findIndex(s => s.endpoint === sub.endpoint);
        if (idx !== -1) {
          console.log('[PUSH] Removing invalid subscription (404/410)');
          subscriptions.splice(idx, 1);
          persistSubscriptions();
          console.log(`[PUSH] Removed. Total subscriptions: ${subscriptions.length}`);
        }
      } catch (e) {
        console.error('[PUSH] Failed to remove invalid subscription:', e.message);
      }
    }

    // Handle auth/forbidden responses: often indicates expired credentials for this subscription
    // Track failures and remove after repeated 401/403 to avoid spamming push service
    if (status === 401 || status === 403) {
      try {
        const idx = subscriptions.findIndex(s => s.endpoint === sub.endpoint);
        if (idx !== -1) {
          subscriptions[idx]._failCount = (subscriptions[idx]._failCount || 0) + 1;
          console.log(`[PUSH] Subscription auth failure count: ${subscriptions[idx]._failCount} for endpoint ${sub.endpoint.substring(0,60)}...`);
          if (subscriptions[idx]._failCount >= 3) {
            console.log('[PUSH] Removing subscription after repeated 401/403 failures');
            subscriptions.splice(idx, 1);
            persistSubscriptions();
            console.log(`[PUSH] Removed. Total subscriptions: ${subscriptions.length}`);
          } else {
            // persist fail count so restarts retain the info
            persistSubscriptions();
          }
        }
      } catch (e) {
        console.error('[PUSH] Failed to update/remove subscription on 401/403:', e.message);
      }
    }

    // Retry on network errors but not on auth/invalid subscription errors
    if (retryCount < MAX_RETRIES && status !== 400 && status !== 403 && status !== 404 && status !== 410) {
      console.log(`[PUSH] Retrying in 2 seconds (${retryCount + 1}/${MAX_RETRIES})...`);
      return new Promise(resolve => {
        setTimeout(() => {
          sendNotification(sub, payload, opts, retryCount + 1).then(resolve).catch(() => resolve(false));
        }, 2000);
      });
    }

    return false;
  }
}



// Track last messages sent to avoid duplicates
let lastScheduledHour = -1;
let lastRandomMinute = -1;

function sendMessages() {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.log('[SEND] ⚠ VAPID keys not configured');
    return;
  }
  if (subscriptions.length === 0) {
    console.log('[SEND] ⚠ No subscriptions');
    return;
  }

  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMin = now.getUTCMinutes();
  const localHour = convertToLocalHour(utcHour);

  console.log(`[SEND] UTC ${utcHour}:${String(utcMin).padStart(2,'0')} = Local ${localHour}:${String(utcMin).padStart(2,'0')}`);

  // Send scheduled message at :00 if exists
  if (utcMin === 0 && scheduledMessages[utcHour] && lastScheduledHour !== utcHour) {
    lastScheduledHour = utcHour;
    const payload = { title: 'Notifikasi Sayang 💌', body: scheduledMessages[utcHour] };
    console.log(`[SEND] SCHEDULED for UTC ${utcHour}:00 (Local ${localHour}:00)`);
    subscriptions.forEach(sub => sendNotification(sub, payload));
    return;
  }

  // Send random message at :00 and :30 (skip if just sent scheduled)
  if ((utcMin === 0 || utcMin === 30) && lastRandomMinute !== utcMin) {
    // Skip random at :00 if scheduled exists
    if (utcMin === 0 && scheduledMessages[utcHour]) return;
    
    lastRandomMinute = utcMin;
    const msg = messages30min[Math.floor(Math.random() * messages30min.length)];
    const payload = { title: 'Notifikasi Sayang 💌', body: msg };
    console.log(`[SEND] RANDOM at UTC ${utcHour}:${String(utcMin).padStart(2,'0')} (Local ${localHour}:${String(utcMin).padStart(2,'0')})`);
    subscriptions.forEach(sub => sendNotification(sub, payload, { TTL: 30 }));
  }

  // Reset trackers when minute changes
  if (utcMin !== 0 && utcMin !== 30) {
    lastRandomMinute = -1;
  }
  if (utcMin !== 0) {
    lastScheduledHour = -1;
  }
}

function scheduleTimers() {
  console.log('[SCHEDULER] Starting timer - checking every minute');
  setInterval(() => {
    sendMessages();
  }, 60 * 1000);
  // Send immediately on start
  setTimeout(() => sendMessages(), 2000);
}

const testIntervalSec = parseInt(process.env.TEST_INTERVAL_SECONDS || '0', 10);
if (testIntervalSec > 0) {
  console.log(`[TEST MODE] Checking every ${testIntervalSec} seconds`);
  setInterval(() => sendMessages(), testIntervalSec * 1000);
  setTimeout(() => sendMessages(), 2000);
} else {
  scheduleTimers();
}

// Send welcome notification when user subscribes
function sendWelcomeNotification(sub) {
  const welcomeMessages = [
    'MAKACII SAYANGKUU CINTAKUWWW UDAAA IZININ AKUU BUATT NGIRIM PESAN PESAN INI UNTUK NEMENIN SAYANG SETIAP HARI 💌💕💖💗💓💞',
    'MAKACII SAYANGKUU CINTAKUWWW UDAAA IZININ AKUU BUATT NGIRIM PESAN PESAN INI UNTUK NEMENIN SAYANG SETIAP HARI 💘❤️💑💏💝',
    'MAKACII SAYANGKUU CINTAKUWWW UDAAA IZININ AKUU BUATT NGIRIM PESAN PESAN INI UNTUK NEMENIN SAYANG SETIAP HARI ❣️💕💖✨🌹',
    'MAKACII SAYANGKUU CINTAKUWWW UDAAA IZININ AKUU BUATT NGIRIM PESAN PESAN INI UNTUK NEMENIN SAYANG SETIAP HARI 💗💓💞💕',
  ];
  
  const welcomeMsg = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
  
  const welcomePayload = {
    title: 'Notifikasi Sayang 💌',
    body: welcomeMsg
  };
  
  console.log('\n[WELCOME] ========================================');
  console.log('[WELCOME] Sending welcome notification...');
  console.log('[WELCOME] ========================================');
  
  sendNotification(sub, welcomePayload).then(success => {
    if (success) {
      console.log('[WELCOME] ✓ Welcome notification sent successfully');
    } else {
      console.log('[WELCOME] ✗ Failed to send welcome notification');
    }
  });
}

// Calculate time until next message (every 30 minutes, unless near scheduled)
function getTimeUntilNextMessage() {
  const now = new Date();
  const hour = now.getHours();
  const minutes = now.getMinutes();
  
  let nextSendTime = null;
  let nextType = '';
  
  if (minutes < 30) {
    // Next is :30
    nextSendTime = new Date(now);
    nextSendTime.setMinutes(30, 0, 0);
    nextType = 'random (in 30 minutes)';
  } else {
    // Next is :00 next hour
    nextSendTime = new Date(now);
    nextSendTime.setHours(hour + 1, 0, 0, 0);
    nextType = 'random (in 30 minutes)';
  }
  
  // Check if scheduled message will be sent
  const nextHour = nextSendTime.getHours();
  if (scheduledMessages[nextHour] && nextSendTime.getMinutes() === 0) {
    nextType = '⭐ scheduled';
  }
  
  return {
    time: nextSendTime,
    type: nextType,
    msUntil: nextSendTime.getTime() - now.getTime()
  };
}

app.post('/sendNow', (req, res) => {
  sendMessages();
  res.json({ sent: true });
});

// New endpoint for welcome notification on subscribe
app.post('/sendWelcome', (req, res) => {
  const sub = req.body;
  
  if (!sub || !sub.endpoint) {
    return res.status(400).json({ success: false, error: 'Invalid subscription' });
  }
  
  // Send welcome immediately
  sendWelcomeNotification(sub);
  
  // Calculate when to send next message
  const nextMsg = getTimeUntilNextMessage();
  const minutesUntil = Math.ceil(nextMsg.msUntil / 1000 / 60);
  
  console.log(`[WELCOME] Next message (${nextMsg.type}) in ${minutesUntil} minutes`);
  
  res.json({
    success: true,
    welcomeSent: true,
    nextMessage: {
      type: nextMsg.type,
      time: nextMsg.time.toLocaleString(),
      minutesUntil: minutesUntil
    }
  });
});

// Debug: expose scheduler state for troubleshooting
app.get('/debug/state', (req, res) => {
  const now = new Date();
  res.json({
    subscriptions: subscriptions.length,
    lastScheduledHour,
    lastRandomMinute,
    currentHour: now.getUTCHours(),
    currentMinute: now.getUTCMinutes(),
    currentLocalHour: convertToLocalHour(now.getUTCHours()),
    defaultTimezone: DEFAULT_TIMEZONE,
    defaultOffset: DEFAULT_OFFSET,
    scheduledHours: Object.keys(scheduledMessages).map(h => parseInt(h, 10)),
    scheduledMessages: scheduledMessages
  });
});

// Debug: list all scheduled messages with their content
app.get('/debug/scheduled', (req, res) => {
  const now = new Date();
  const hour = now.getHours();
  const messages = Object.entries(scheduledMessages).map(([h, msg]) => ({
    hour: parseInt(h),
    message: msg.substring(0, 80) + '...',
    isNow: parseInt(h) === hour,
    isScheduled: !!scheduledMessages[h]
  }));
  res.json({
    currentHour: hour,
    currentTime: now.toISOString(),
    scheduledMessages: messages
  });
});

// Public endpoint returning full scheduled messages mapping (used by client scheduler)
app.get('/scheduled', (req, res) => {
  res.json({ success: true, scheduledMessages });
});

// Endpoint for client to sync its device time with server
// Client sends its device time (Date.now()) and gets back server's timing info
app.post('/sync-time', (req, res) => {
  const serverTime = Date.now();
  const now = new Date();
  res.json({
    success: true,
    serverTime,
    serverLocalTime: now.toISOString(),
    utcHour: now.getUTCHours(),
    utcMinute: now.getUTCMinutes(),
    localHour: convertToLocalHour(now.getUTCHours())
  });
});

const port = process.env.PORT || 3000;
const server = app.listen(port, () => console.log(`Server listening on ${port}`));

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`FATAL: Port ${port} already in use (EADDRINUSE).`);
    console.error('Tip: stop the other process using this port or set PORT env var to another port.');
    console.error('On Windows: run `netstat -ano | findstr :'+port+'` then `taskkill /PID <pid> /F`.');
    process.exit(1);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

// Global error handlers so server doesn't exit silently
process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
