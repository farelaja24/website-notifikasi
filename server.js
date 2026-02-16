const express = require('express');
const bodyParser = require('body-parser');
const webpush = require('web-push');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const VAPID_FILE = 'vapid.json';
const SUBS_FILE = 'subscriptions.json';

let VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
let VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
let subscriptions = [];

// Load VAPID keys
try {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    if (fs.existsSync(VAPID_FILE)) {
      const v = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8'));
      VAPID_PUBLIC = VAPID_PUBLIC || v.publicKey || '';
      VAPID_PRIVATE = VAPID_PRIVATE || v.privateKey || '';
      console.log('Loaded VAPID keys from', VAPID_FILE);
    }
  }
} catch (e) {
  console.error('VAPID key handling error:', e);
}

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails('mailto:you@example.com', VAPID_PUBLIC, VAPID_PRIVATE);
  console.log('VAPID configured');
} else {
  console.warn('VAPID keys missing');
}

// Load subscriptions
try {
  if (fs.existsSync(SUBS_FILE)) {
    subscriptions = JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8')) || [];
    console.log('Loaded', subscriptions.length, 'subscriptions');
  }
} catch (e) {
  console.error('Failed loading subscriptions:', e);
}

function persistSubscriptions() {
  try {
    fs.writeFileSync(SUBS_FILE, JSON.stringify(subscriptions, null, 2));
    console.log('[PERSIST] Saved', subscriptions.length, 'subscriptions');
  } catch (e) {
    console.error('[PERSIST] Failed:', e.message);
  }
}

// Messages
const messages30min = [
  'SAYANGG CANTIK BANGETTTT AAAAAAAA',
  'SAYANGGKUUU GEMESH BANGETTT',
  'SAYANGKUWW CINTAKUWWW UCUK BANGETTTT',
  'SAYANG ADAA YANG DIPIKIRIN TIDAAA, LET ME KNOW YAK CINTAAAA',
  'CHAT ME ANYTIME SAYANGGGGG',
  'I LOVVVVVV UUUUU MOREEEE SAYANGGGG CANTIKKK UCUKKK GEMESHH BAHENOL SEXYYY',
  'I LOVVVVVV UUU THE MOST SAYANGGGGG CANTIKKKK',
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

// Send notification
async function sendNotification(sub, payload) {
  if (!sub || !sub.endpoint || !sub.keys) {
    console.error('[PUSH] Invalid subscription');
    return false;
  }
  
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload));
    console.log('[PUSH] ✓ Sent');
    return true;
  } catch (err) {
    console.error('[PUSH] ✗ Failed:', err.message);
    const status = err.statusCode;
    if (status === 404 || status === 410) {
      const idx = subscriptions.findIndex(s => s.endpoint === sub.endpoint);
      if (idx !== -1) {
        subscriptions.splice(idx, 1);
        persistSubscriptions();
        console.log('[PUSH] Removed invalid subscription');
      }
    }
    return false;
  }
}

// Send messages (random only)
function sendMessages() {
  const now = new Date();
  const hour = now.getHours();
  const min = now.getMinutes();
  
  console.log(`[CHECK] ${hour}:${String(min).padStart(2,'0')} - VAPID: ${!!VAPID_PUBLIC}, Subs: ${subscriptions.length}`);

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.log('[SEND] ⚠ VAPID not configured');
    return;
  }
  
  if (subscriptions.length === 0) {
    console.log('[SEND] ⚠ No subscriptions');
    return;
  }

  // Send random message
  const msg = messages30min[Math.floor(Math.random() * messages30min.length)];
  const payload = { title: 'Notifikasi Sayang 💌', body: msg };
  console.log(`[SEND] RANDOM to ${subscriptions.length} subscribers`);
  
  subscriptions.forEach((sub, idx) => {
    console.log(`[SEND] Sending to subscriber ${idx + 1}/${subscriptions.length}`);
    sendNotification(sub, payload);
  });
}

// Routes
app.get('/vapidPublicKey', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC });
});

app.post('/subscribe', (req, res) => {
  const sub = req.body;
  console.log('[SUBSCRIBE] Received subscription request');
  
  if (!sub || !sub.endpoint || !sub.keys) {
    console.error('[SUBSCRIBE] Invalid subscription data');
    return res.status(400).json({ success: false, error: 'Invalid subscription' });
  }
  
  const exists = subscriptions.find(s => s.endpoint === sub.endpoint);
  if (!exists) {
    subscriptions.push(sub);
    persistSubscriptions();
    console.log('[SUBSCRIBE] New subscription (total:', subscriptions.length + ')');
    
    // Send welcome notification immediately
    const welcomePayload = {
      title: 'Notifikasi Sayang 💌',
      body: 'MAACIWWW SAYANGGGG UDAAAAA IZININNNN AKUUU BUATT NEMENINNN SAYANGGG DENGANN PESAN PESAN CINTAA DARII AKUWWWW'
    };
    console.log('[WELCOME] Sending welcome notification...');
    sendNotification(sub, welcomePayload).then(ok => {
      if (ok) console.log('[WELCOME] ✓ Welcome sent');
      else console.log('[WELCOME] ✗ Welcome failed');
    });
  } else {
    console.log('[SUBSCRIBE] Subscription already exists');
  }
  
  res.json({ success: true });
});

app.post('/unsubscribe', (req, res) => {
  const sub = req.body;
  const idx = subscriptions.findIndex(s => s.endpoint === sub.endpoint);
  if (idx !== -1) {
    subscriptions.splice(idx, 1);
    persistSubscriptions();
    return res.json({ success: true });
  }
  res.json({ success: false });
});

app.get('/subscriptions', (req, res) => {
  res.json({ count: subscriptions.length, subscriptions });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    subscriptionCount: subscriptions.length
  });
});

app.get('/debug/test-send', (req, res) => {
  console.log('[DEBUG] Manual test triggered');
  const msg = messages30min[0];
  const payload = { title: 'Notifikasi Sayang 💌', body: msg };
  console.log(`[DEBUG] Sending to ${subscriptions.length} subscribers`);
  
  let sent = 0;
  subscriptions.forEach((sub, idx) => {
    console.log(`[DEBUG] Sending to subscriber ${idx + 1}`);
    sendNotification(sub, payload).then(ok => {
      if (ok) sent++;
      if (idx === subscriptions.length - 1) {
        console.log(`[DEBUG] Sent ${sent}/${subscriptions.length}`);
      }
    });
  });
  
  res.json({ sent: true, subscribers: subscriptions.length });
});

app.post('/sendWelcome', (req, res) => {
  const sub = req.body;
  if (!sub || !sub.endpoint) {
    return res.status(400).json({ success: false, error: 'Invalid subscription' });
  }
  
  const welcomePayload = {
    title: 'Notifikasi Sayang 💌',
    body: 'MAACIWWW SAYANGGGG UDAAAAA IZININNNN AKUUU BUATT NEMENINNN SAYANGGG DENGANN PESAN PESAN CINTAA DARII AKUWWWW'
  };
  
  console.log('[WELCOME] Sending welcome notification...');
  sendNotification(sub, welcomePayload).then(ok => {
    if (ok) {
      console.log('[WELCOME] ✓ Welcome sent');
      res.json({ success: true });
    } else {
      console.log('[WELCOME] ✗ Welcome failed');
      res.json({ success: false });
    }
  });
});

app.get('/scheduled', (req, res) => {
  res.json({ success: true, scheduledMessages });
});

app.post('/sync-time', (req, res) => {
  res.json({
    success: true,
    serverTime: Date.now(),
    serverLocalTime: new Date().toISOString()
  });
});

// Scheduler
console.log('[INIT] Setting up scheduler...');
console.log('[INIT] Current time:', new Date().toLocaleString());
console.log('[INIT] Scheduled hours:', Object.keys(scheduledMessages).join(', '));

// Schedule exact time for each scheduled message
Object.keys(scheduledMessages).forEach(hour => {
  const scheduleHour = parseInt(hour);
  
  function scheduleForHour() {
    const now = new Date();
    const target = new Date(now);
    target.setHours(scheduleHour, 0, 0, 0);
    
    // If target time already passed today, schedule for tomorrow
    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }
    
    const msUntil = target.getTime() - now.getTime();
    console.log(`[SCHEDULER] Scheduled message for ${scheduleHour}:00 in ${Math.round(msUntil/1000/60)} minutes`);
    
    setTimeout(() => {
      console.log(`[SCHEDULER] Triggering scheduled message for ${scheduleHour}:00`);
      if (subscriptions.length > 0) {
        const payload = { title: 'Notifikasi Sayang 💌', body: scheduledMessages[scheduleHour] };
        subscriptions.forEach((sub, idx) => {
          console.log(`[SEND] SCHEDULED ${scheduleHour}:00 to subscriber ${idx + 1}/${subscriptions.length}`);
          sendNotification(sub, payload);
        });
      }
      // Schedule again for next day
      scheduleForHour();
    }, msUntil);
  }
  
  scheduleForHour();
});

// Random messages every 10 minutes
console.log('[INIT] Random messages every 10 minutes');

setTimeout(() => {
  console.log('[SCHEDULER] Initial random check...');
  sendMessages();
}, 3000);

setInterval(() => {
  console.log('[SCHEDULER] Periodic random check...');
  sendMessages();
}, 10 * 60 * 1000);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on ${port}`));
