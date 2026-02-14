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
    
    await webpush.sendNotification(sub, JSON.stringify(payload));
    console.log('[PUSH] ✓ Sent successfully');
    return true;
  } catch (err) {
    const status = err && err.statusCode ? err.statusCode : null;
    console.error(`[PUSH] ✗ Failed with status ${status}: ${err.message || JSON.stringify(err)}`);
    
    // Remove invalid subscriptions
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
  
  // Determine message to send
  let msg = scheduledMessages[hour];
  let msgType = 'scheduled';
  
  if (!msg) {
    msg = messages30min[Math.floor(Math.random() * messages30min.length)];
    msgType = 'random (30min)';
  }
  
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
    // Every minute check for scheduled top-of-hour messages
    setInterval(() => {
      const now = new Date();
      const hour = now.getHours();
      const minutes = now.getMinutes();
      if (scheduledMessages[hour] && minutes === 0) {
        console.log(`[SCHEDULED] Sending message for hour ${hour}`);
        sendAllRandom();
      }
    }, 60 * 1000);

    // Every 30 minutes: check and send at :00 and :30
    setInterval(() => {
      const now = new Date();
      const minutes = now.getMinutes();
      const hour = now.getHours();
      if ((minutes === 0 || minutes === 30) && !(minutes === 0 && scheduledMessages[hour])) {
        console.log('[30MIN] Sending random message cycle');
        sendAllRandom();
      }
    }, 30 * 1000); // check more frequently near the minute to avoid drift

  }, msUntilNextMinute());
}

// Default: send notification every 10 seconds for testing
// Can be overridden with TEST_INTERVAL_SECONDS environment variable
const testIntervalSec = parseInt(process.env.TEST_INTERVAL_SECONDS || '10', 10);
if (testIntervalSec && testIntervalSec > 0) {
  console.log(`TEST MODE: sending every ${testIntervalSec} seconds`);
  // log a tick so we can verify the interval is running
  setInterval(() => {
    console.log(`[TEST MODE] tick at ${new Date().toISOString()}`);
    sendAllRandom();
  }, testIntervalSec * 1000);
} else {
  scheduleTimers();
}

app.post('/sendNow', (req, res) => {
  sendAllRandom();
  res.json({ sent: true });
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
