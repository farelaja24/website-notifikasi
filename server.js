const express = require('express');
const bodyParser = require('body-parser');
const webpush = require('web-push');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const fs = require('fs');
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails('mailto:you@example.com', VAPID_PUBLIC, VAPID_PRIVATE);
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

app.get('/subscriptions', (req, res) => {
  res.json({ count: subscriptions.length, subscriptions });
});

const messages = [
  'Kamu cantik sekali 😍',
  'Jangan lupa makan ya ❤️',
  'Aku sayang kamu 💕',
  'Semangat ya hari ini!',
  'Istirahat sebentar, minum air :)'
];

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
  const msg = messages[Math.floor(Math.random() * messages.length)];
  const payload = { title: 'Pesan Sayang', body: msg };
  console.log('\n[SEND] Broadcasting message to', subscriptions.length, 'subscribers...');
  console.log('[SEND] Message:', payload.body);
  subscriptions.forEach(sub => sendNotification(sub, payload));
  console.log('[SEND] Done\n');
}

// send every 1 hour
setInterval(sendAllRandom, 1000 * 60 * 60);

app.post('/sendNow', (req, res) => {
  sendAllRandom();
  res.json({ sent: true });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on ${port}`));
