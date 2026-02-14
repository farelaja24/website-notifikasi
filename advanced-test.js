#!/usr/bin/env node

/**
 * Advanced Notification Test Script
 * Testing notification delivery when browser is closed
 * Usage: node advanced-test.js
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

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runAdvancedTests() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   🧪 Advanced Web Push Notification Test Suite    ║');
  console.log('║        for Closed Browser Scenario                 ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');
  
  try {
    // Test 1: Health Check
    console.log('📋 TEST 1: Server Health Check');
    console.log('━'.repeat(50));
    const health = await makeRequest('/health');
    
    if (health.status !== 200) {
      console.error('❌ Server not responding properly');
      process.exit(1);
    }
    
    console.log('✅ Status: OK');
    console.log('✅ VAPID Configured:', health.data.vapidConfigured);
    console.log('✅ Server Uptime:', Math.floor(health.data.serverUptime), 'seconds');
    console.log('✅ Active Subscriptions:', health.data.subscriptionCount);
    
    if (health.data.subscriptionCount === 0) {
      console.error('\n❌ NO SUBSCRIPTIONS FOUND!');
      console.log('👉 Steps to fix:');
      console.log('   1. Open http://localhost:3000');
      console.log('   2. Click "Izinkan Notifikasi"');
      console.log('   3. Allow notification permission');
      console.log('   4. Run this test again\n');
      process.exit(1);
    }
    
    // Test 2: Subscription Details
    console.log('\n📋 TEST 2: Subscription Details');
    console.log('━'.repeat(50));
    const details = await makeRequest('/debug/subscriptions');
    console.log('✅ Total Subscriptions:', details.data.count);
    
    if (details.data.details && details.data.details.length > 0) {
      details.data.details.forEach((sub, idx) => {
        console.log(`\n   Subscription ${idx + 1}:`);
        console.log(`   - Endpoint: ${sub.endpoint}`);
        console.log(`   - Auth Key: ${sub.auth}`);
        console.log(`   - P256DH Key: ${sub.p256dh}`);
      });
    }
    
    // Test 3: Send Notification
    console.log('\n\n📋 TEST 3: Send Test Notifications');
    console.log('━'.repeat(50));
    console.log('⏳ Triggering notifications...\n');
    
    const sendResult = await makeRequest('/debug/test-send', 'GET');
    
    if (sendResult.status === 200) {
      console.log('✅ Test notifications triggered!');
      console.log('✅ Timestamp:', sendResult.data.timestamp);
      
      console.log('\n📌 IMPORTANT NEXT STEPS:');
      console.log('━'.repeat(50));
      console.log('\n🔴 NOW CLOSE YOUR BROWSER COMPLETELY:');
      console.log('   1. Close ALL Chrome/Edge windows');
      console.log('   2. Wait 2-3 seconds');
      console.log('   3. Look for notification popup in Windows notification area');
      console.log('   4. Check Windows notification center (bottom right)');
      
      console.log('\n⏱️  Waiting for notifications to arrive...\n');
      
      // Wait and monitor
      for (let i = 10; i > 0; i--) {
        console.log(`   Waiting... ${i}s remaining for notification to appear`);
        await sleep(1000);
      }
      
      console.log('\n📋 TEST 4: Verification');
      console.log('━'.repeat(50));
      console.log('Did you see notification popup? (Y/N)');
      console.log('\n✅ If YES:');
      console.log('   → Everything is working correctly!');
      console.log('   → Notifications will show even when browser is closed');
      
      console.log('\n❌ If NO:');
      console.log('   → Check troubleshooting guide in NOTIFICATION_CLOSED_BROWSER_FIX.md');
      console.log('   → Ensure Windows notification permissions are enabled');
      console.log('   → Check Windows Settings → Notifications & actions');
      console.log('   → Verify Chrome/Edge has notification permission enabled');
      
    } else {
      console.error('❌ Failed to send notifications');
      console.error('Status:', sendResult.status);
    }
    
    // Summary
    console.log('\n\n╔══════════════════════════════════════════════════════╗');
    console.log('║              ✅ TEST SUITE COMPLETE                 ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');
    
  } catch (error) {
    console.error('❌ Error running tests:');
    console.error('   ', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('   Make sure server is running: node server.js');
    console.log('   Make sure you have subscriptions (open http://localhost:3000)');
    process.exit(1);
  }
}

// Run tests
runAdvancedTests().catch(console.error);
