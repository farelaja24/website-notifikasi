#!/usr/bin/env node

/**
 * Test Script untuk Web Push Notifications
 * Gunakan: node test-notifications.js
 */

const http = require('http');

function makeRequest(endpoint, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: endpoint,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data
          });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.setTimeout(5000);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Web Push Notification Test Suite\n');
  
  try {
    // Test 1: Health Check
    console.log('1️⃣  Testing server health...');
    const health = await makeRequest('/health');
    console.log(`   ✓ Status: ${health.status}`);
    console.log(`   ✓ Server is running`);
    console.log(`   ✓ VAPID Configured: ${health.data.vapidConfigured}`);
    console.log(`   ✓ Active Subscriptions: ${health.data.subscriptionCount}\n`);

    // Test 2: Check Subscriptions
    console.log('2️⃣  Checking subscriptions...');
    const subs = await makeRequest('/subscriptions');
    console.log(`   ✓ Total subscriptions: ${subs.data.count}`);
    
    if (subs.data.count === 0) {
      console.log('   ⚠️  No subscriptions found!');
      console.log('   👉 Please open http://localhost:3000 and click "Izinkan Notifikasi"\n');
    } else {
      console.log(`   ✓ Subscriptions ready to receive notifications\n`);
      
      // Test 3: Send Test Notification
      console.log('3️⃣  Sending test notifications...');
      const send = await makeRequest('/debug/test-send', 'GET');
      console.log(`   ✓ Notifications sent!`);
      console.log(`   ✓ Check your browser for notification(s)\n`);
      
      console.log('✅ All tests passed!');
      console.log('\n📝 Next Steps:');
      console.log('   - Check browser notification');
      console.log('   - Try minimizing the window');
      console.log('   - Notifications should still appear\n');
    }

  } catch (error) {
    console.error('❌ Error running tests:');
    console.error('   ', error.message);
    console.log('\n💡 Make sure server is running: node server.js\n');
    process.exit(1);
  }
}

runTests().catch(console.error);
