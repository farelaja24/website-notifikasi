#!/usr/bin/env node

/**
 * Test Railway deployment scheduled sends
 * Usage: node test-railway-scheduled.js <railway-url> <test-hour>
 * Example: node test-railway-scheduled.js https://notification-6c01.up.railway.app 13
 */

const http = require('http');
const https = require('https');

const railwayUrl = process.argv[2] || 'http://localhost:3000';
const testHour = parseInt(process.argv[3] || '13', 10);

if (!railwayUrl) {
  console.error('Usage: node test-railway-scheduled.js <url> [hour]');
  process.exit(1);
}

console.log(`\n📋 Railway Scheduled Messages Test`);
console.log(`========================================`);
console.log(`URL: ${railwayUrl}`);
console.log(`Test Hour: ${testHour}`);
console.log(`========================================\n`);

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, railwayUrl);
    const client = url.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'GET'
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function test() {
  try {
    // 1. Check server health
    console.log('1️⃣  Checking server health...');
    const health = await makeRequest('/health');
    console.log(`   ✓ Server status: ${health.status}`);
    console.log(`   ✓ VAPID configured: ${health.data.vapidConfigured}`);
    console.log(`   ✓ Subscriptions: ${health.data.subscriptionCount}\n`);

    // 2. Check current scheduled messages
    console.log('2️⃣  Checking scheduled messages...');
    const scheduled = await makeRequest('/debug/scheduled');
    console.log(`   ✓ Current hour: ${scheduled.data.currentHour}`);
    console.log(`   ✓ Server time: ${scheduled.data.currentTime}`);
    console.log(`   ✓ Scheduled hours configured: ${scheduled.data.scheduledMessages.map(m => m.hour).join(', ')}`);
    if (scheduled.data.scheduledMessages.find(m => m.hour === testHour)) {
      console.log(`   ✓ Hour ${testHour} IS scheduled\n`);
    } else {
      console.log(`   ⚠️  Hour ${testHour} is NOT configured\n`);
    }

    // 3. Check scheduler state
    console.log('3️⃣  Checking scheduler state...');
    const state = await makeRequest('/debug/state');
    console.log(`   ✓ Subscriptions: ${state.data.subscriptions}`);
    console.log(`   ✓ Current time: ${state.data.currentTime}`);
    console.log(`   ✓ Current hour: ${state.data.currentHour}`);
    console.log(`   ✓ Current minute: ${state.data.currentMinute}`);
    console.log(`   ✓ Last scheduled sent: ${state.data.lastScheduledSentAtIso || 'never'}\n`);

    // 4. Force send scheduled message
    console.log(`4️⃣  Force-sending scheduled message for hour ${testHour}...`);
    const forceSend = await makeRequest(`/debug/send-scheduled/${testHour}`);
    if (forceSend.status === 200) {
      console.log(`   ✓ Force-send triggered`);
      console.log(`   ✓ Recipients: ${forceSend.data.recipients}\n`);
    } else {
      console.log(`   ✗ Force-send failed: ${forceSend.status}\n`);
    }

    // 5. Final state check
    console.log('5️⃣  Final state check...');
    const finalState = await makeRequest('/debug/state');
    console.log(`   ✓ Last scheduled sent: ${finalState.data.lastScheduledSentAtIso || 'never'}`);
    console.log(`   ✓ Test complete!\n`);

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

test();
