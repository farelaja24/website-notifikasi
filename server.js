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
try {
  if (fs.existsSync(SUBS_FILE)) {
    const raw = fs.readFileSync(SUBS_FILE, 'utf8');
    subscriptions = JSON.parse(raw) || [];
    console.log('Loaded', subscriptions.length, 'subscriptions from file');
  }
} catch (e) {
  console.error('Failed loading subscriptions file:', e);
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
      fs.writeFileSync(SUBS_FILE, JSON.stringify(subscriptions, null, 2));
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
      fs.writeFileSync(SUBS_FILE, JSON.stringify(subscriptions, null, 2));
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

async function sendNotification(sub, payload) {
  try {
    console.log('Sending to endpoint:', sub.endpoint.substring(0, 50) + '...');
    await webpush.sendNotification(sub, JSON.stringify(payload));
    console.log('✓ Notification sent successfully');
  } catch (err) {
    console.error('✗ Send error:', err.statusCode, err.body || err.message);
  }
}

function sendAllRandom() {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.log('⚠ VAPID keys not configured — skip sending');
    return;
  }
  if (subscriptions.length === 0) {
    console.log('⚠ No subscriptions registered');
    return;
  }
  
  const now = new Date();
  const hour = now.getHours();
  const minutes = now.getMinutes();
  
  // Check if current hour has a scheduled message
  let msg = scheduledMessages[hour];
  if (msg) {
    console.log(`[SEND] Scheduled message for ${hour}:00 - ${msg.substring(0, 40)}...`);
  } else {
    // send random message from 30-minute list
    msg = messages30min[Math.floor(Math.random() * messages30min.length)];
    console.log(`[SEND] Random message (30min cycle) - ${msg.substring(0, 40)}...`);
  }
  
  const payload = { title: 'Notifikasi Sayang 💌', body: msg };
  console.log(`[SEND] Broadcasting to ${subscriptions.length} subscriber(s) at ${now.toLocaleTimeString()}`);
  subscriptions.forEach(sub => sendNotification(sub, payload));
}

// Check for scheduled messages every minute and send 30-min random messages
setInterval(() => {
  const now = new Date();
  const hour = now.getHours();
  const minutes = now.getMinutes();
  
  // If hour has a scheduled message and it's at the top of the hour (0 minutes), send it
  if (scheduledMessages[hour] && minutes === 0) {
    console.log(`[SCHEDULED] Sending message for hour ${hour}`);
    sendAllRandom();
  }
}, 60 * 1000); // Check every minute

// Send random messages every 30 minutes (at :00 and :30)
setInterval(() => {
  const now = new Date();
  const minutes = now.getMinutes();
  const hour = now.getHours();
  
  // Only send random messages at :00 and :30, but skip if there's a scheduled message at :00
  if ((minutes === 0 || minutes === 30) && !(minutes === 0 && scheduledMessages[hour])) {
    console.log('[30MIN] Sending random message cycle');
    sendAllRandom();
  }
}, 60 * 1000); // Check every minute

// send every 5 seconds
// setInterval(sendAllRandom, 5 * 1000);  // DISABLED - using scheduled approach instead

app.post('/sendNow', (req, res) => {
  sendAllRandom();
  res.json({ sent: true });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on ${port}`));
