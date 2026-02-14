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
  sendAllRandom();
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
  subscriptions.forEach((sub) => {
    sendNotification(sub, payload).then(ok => { if (ok) sent++; });
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

const scheduledMessages = {
  7: 'MORNING SAYANGKUW CINTAKUWWW, SEMOGAA HARI INII SAYANGG BISAKK BAHAGIA DAN SENENGGG DAN MOOD SAYANGG TERJAGAA, JANGAN LUPAA MINUM AIR PUTIH DULU YAKKK💘💘💘💘',
  10: 'JANGAN LUPAA MAMM YAK CINTAKUW SAYANGG, BIAR TIDAA KOSONG PEYUTNYAAAAA, SEMANGAT SAYANGGG, CAMAT MAM SAYANGG DAN KENYANGIN CINTAAAAAA DAN JANGAN LUPA MINUM VITAMIN CINTAAA',
  13: 'JANGAN LUPAA MAMM YAK CINTAKUW SAYANGG, BIAR TIDAA KOSONG PEYUTNYAAAAA, SEMANGAT SAYANGGG, CAMAT MAM SAYANGG DAN KENYANGIN CINTAAAAAA DAN JANGAN LUPA MINUM VITAMIN CINTAAA',
  16: 'JANGAN LUPAA MAMM YAK CINTAKUW SAYANGG, BIAR TIDAA KOSONG PEYUTNYAAAAA, SEMANGAT SAYANGGG, CAMAT MAM SAYANGG DAN KENYANGIN CINTAAAAAA DAN JANGAN LUPA MINUM VITAMIN CINTAAA',
  20: 'JANGAN LUPAA MAM YAK SAYANGG KALO SAYANG MASI LAPERR CINTAAAAAA, I LOVVVVVV UUUUU MOREEEE SAYANGGGG',
  22: 'BOBONYA JANGAN TERLALU MALAM YAKK CANTIKKKKKK, SAYANGG JAGA KESEHATANNNNN YAKKKKK',
  23: 'CAMAT BOBO SAYANGGG, JANGAN LUPAA BACAA DOAA SAYANGG, MIMPII INDAHH DANN BOBO YANG NYENYAK SAYANGGG, GUDNAIT SAYANGGG, I LOVVVVVV UUUUU MOREEEE SAYANGGGG CANTIKKK UCUKKK GEMESHH BAHENOL SEXYYY, BABAYY SAYANGGGGG'
};

async function sendNotification(sub, payload, retryCount = 0) {
  const MAX_RETRIES = 2;
  try {
    const endpoint = sub.endpoint || 'unknown';
    console.log(`[PUSH] Sending to: ${endpoint.substring(0, 60)}... (Attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
    console.log(`[PUSH] Payload: "${payload.body.substring(0, 50)}..."`);
    
    // Set a generous TTL so push services will keep the message queued
    // if the browser is not currently connected. TTL = 3600 seconds (1 hour).
    // Add an Urgency header so push services treat this as higher priority
    // (helps delivery when client is backgrounded).
    await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 60 * 60, headers: { Urgency: 'high' } });
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
          sendNotification(sub, payload, retryCount + 1).then(resolve).catch(() => resolve(false));
        }, 2000);
      });
    }
    
    return false;
  }
}

// Track last messages sent to avoid duplicates
let lastMessageMinute = -1;
// Use timestamp to track last scheduled send to avoid stale hour issues across days
let lastScheduledSentAt = 0; // epoch ms of last scheduled message sent

function checkIfNearScheduled() {
  const now = new Date();
  const hour = now.getHours();
  const minutes = now.getMinutes();
  
  // Check all scheduled hours
  for (const scheduledHour of Object.keys(scheduledMessages).map(h => parseInt(h))) {
    // Calculate minutes until scheduled hour
    let minutesUntilScheduled = 0;
    
    if (scheduledHour > hour) {
      // Scheduled is later today
      minutesUntilScheduled = (scheduledHour - hour) * 60 - minutes;
    } else if (scheduledHour < hour) {
      // Scheduled is tomorrow
      minutesUntilScheduled = (24 - hour + scheduledHour) * 60 - minutes;
    } else {
      // Same hour as scheduled
      minutesUntilScheduled = -minutes; // already passed :00 of this hour
    }
    
    // If within 1-29 minutes before scheduled
    if (minutesUntilScheduled >= 1 && minutesUntilScheduled <= 29) {
      return {
        isNear: true,
        scheduledHour: scheduledHour,
        minutesUntil: minutesUntilScheduled
      };
    }
  }
  
  return { isNear: false };
}

function sendAllRandom() {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.log('[SEND] ⚠ VAPID keys not configured — skipping');
    return;
  }
  if (subscriptions.length === 0) {
    console.log('[SEND] ⚠ No subscriptions registered');
    return;
  }
  
  const now = new Date();
  const hour = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  
  // Only process at :00 and :30
  if (minutes !== 0 && minutes !== 30) {
    console.log(`[SEND] ℹ️  Not a send time (${minutes}), need :00 or :30`);
    return;
  }
  
  // Prevent duplicate sends within the same minute
  if (lastMessageMinute === (hour * 60 + minutes)) {
    console.log(`[SEND] ℹ️  Already sent message this minute, skipping duplicate`);
    return;
  }
  
  let msg = null;
  let msgType = 'none';
  let isScheduled = false;
  
  // Priority 1: Check if at scheduled hour (:00)
  if (minutes === 0 && scheduledMessages[hour]) {
    // Only send scheduled if we haven't sent a scheduled message in the last hour
    const nowMs = Date.now();
    if (nowMs - lastScheduledSentAt > 60 * 60 * 1000) {
      msg = scheduledMessages[hour];
      msgType = '⭐ SCHEDULED';
      isScheduled = true;
      lastScheduledSentAt = nowMs;
      console.log(`[SEND] >>> SCHEDULED MESSAGE TIME! Hour: ${hour}:00 <<<`);
    } else {
      console.log(`[SEND] ℹ️  Scheduled message for hour ${hour} was already sent recently, skipping`);
      return;
    }
  }
  else if (minutes === 0 && !scheduledMessages[hour]) {
    // Log when a :00 minute occurs but no scheduled message for this hour
    console.log(`[SEND] ℹ️  :00 check - hour ${hour} has NO scheduled message (scheduled hours: ${Object.keys(scheduledMessages).join(',')})`);
  }
  // Priority 2: Check if near scheduled (1-29 minutes away)
  else if (minutes === 30) {
    // At :30, check if next hour is scheduled and we haven't sent it yet
    const nextHour = (hour + 1) % 24;
    if (scheduledMessages[nextHour]) {
      // Next hour is scheduled, don't send random at :30
      const minutesUntilScheduled = 60 - minutes; // should be 30 minutes
      console.log(`[SEND] ℹ️  Skipping random at :30 - scheduled message in ${minutesUntilScheduled} minutes`);
      return;
    }
    
    // Check if within 1-29 minutes before ANY scheduled message
    const nearScheduled = checkIfNearScheduled();
    if (nearScheduled.isNear) {
      console.log(`[SEND] ℹ️  Within ${nearScheduled.minutesUntil} minutes of scheduled message - skipping random`);
      return;
    }
    
    // Send random at :30
    msg = messages30min[Math.floor(Math.random() * messages30min.length)];
    msgType = 'random (30min)';
  }
  // At :00 but not scheduled
  else if (minutes === 0) {
    // Check if within 1-29 minutes before ANY scheduled message
    const nearScheduled = checkIfNearScheduled();
    if (nearScheduled.isNear) {
      console.log(`[SEND] ℹ️  Within ${nearScheduled.minutesUntil} minutes of scheduled message - skipping random`);
      return;
    }
    
    // Send random at :00
    msg = messages30min[Math.floor(Math.random() * messages30min.length)];
    msgType = 'random (00min)';
  }
  
  // If no message determined, return
  if (!msg) {
    return;
  }
  
  lastMessageMinute = hour * 60 + minutes;
  
  const payload = { 
    title: 'Notifikasi Sayang 💌', 
    body: msg 
  };
  
  console.log(`\n[SEND] ========================================`);
  console.log(`[SEND] Time: ${now.toLocaleString()} (${hour}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')})`);
  console.log(`[SEND] Type: ${msgType}`);
  console.log(`[SEND] Message: "${msg.substring(0, 60)}..."`);
  console.log(`[SEND] Recipients: ${subscriptions.length}`);
  console.log(`[SEND] ========================================`);
  
  let successCount = 0;
  let failCount = 0;
  
  subscriptions.forEach((sub, idx) => {
    console.log(`[SEND] Delivering to subscription ${idx + 1}/${subscriptions.length}...`);
    sendNotification(sub, payload).then(success => {
      if (success) {
        successCount++;
        console.log(`[SEND] Success count: ${successCount}/${subscriptions.length}`);
      } else {
        failCount++;
        console.log(`[SEND] Fail count: ${failCount}`);
      }
    });
  });
}

// Robust scheduling:
//  - scheduledMessages: sent at top of the hour (00)
//  - random 30-min messages: sent at :00 and :30 (unless a scheduled message is sent at :00)

function msUntilNextMinute() {
  const now = new Date();
  return 60000 - (now.getSeconds() * 1000 + now.getMilliseconds());
}

function scheduleTimers() {
  // Align to next minute then set recurring intervals
  setTimeout(() => {
    // Every minute, check for messages at :00 and :30
    setInterval(() => {
      const now = new Date();
      const minutes = now.getMinutes();
      
      // Send message at every :00 and :30
      if (minutes === 0 || minutes === 30) {
        console.log(`[SCHEDULER] Time is ${minutes} - checking for message to send...`);
        sendAllRandom();
      }
    }, 60 * 1000);

  }, msUntilNextMinute());
}

// Default: send notification every 10 seconds for testing
// Can be overridden with TEST_INTERVAL_SECONDS environment variable
const testIntervalSec = parseInt(process.env.TEST_INTERVAL_SECONDS || '10', 10);
if (testIntervalSec && testIntervalSec > 0) {
  console.log(`TEST MODE: checking messages every ${testIntervalSec} seconds`);
  console.log('📌 SYSTEM: Random message every 30 min (:00 & :30)');
  console.log('📌 SMART: Skip random if within 1-29 min before scheduled\n');

  let lastCheckMinute = -1;
  let lastCheckHour = -1;

  setInterval(() => {
    const now = new Date();
    const minutes = now.getMinutes();
    const hour = now.getHours();

    // Reset scheduled tracker when hour changes
    if (hour !== lastCheckHour) {
      lastScheduledSentAt = 0;
      lastCheckHour = hour;
    }

    // Only check at :00 and :30
    if (minutes === 0 || minutes === 30) {
      if (lastCheckMinute !== minutes) {
        console.log(`[TEST MODE] At :${String(minutes).padStart(2, '0')} - ${now.toISOString()}`);
        sendAllRandom();
        lastCheckMinute = minutes;
      }
    }
  }, testIntervalSec * 1000);
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
  // This is for manual testing/immediate send
  sendAllRandom();
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
    lastMessageMinute,
    lastScheduledSentAt,
    lastScheduledSentAtIso: lastScheduledSentAt ? new Date(lastScheduledSentAt).toISOString() : null,
    serverTime: now.toISOString(),
    currentHour: now.getHours(),
    currentMinute: now.getMinutes(),
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

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on ${port}`));

// Global error handlers so server doesn't exit silently
process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
