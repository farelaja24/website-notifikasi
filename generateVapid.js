const webpush = require('web-push');
const fs = require('fs');

console.log('Generating fresh VAPID keys...');
const keys = webpush.generateVAPIDKeys();

console.log('\n✓ Generated keys:');
console.log('  Public Key:', keys.publicKey);
console.log('  Private Key:', keys.privateKey);

// Validate key format
function validateKey(key) {
  const padding = '='.repeat((4 - key.length % 4) % 4);
  const base64 = (key + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = Buffer.from(base64, 'base64');
  console.log(`\n  Decoded length: ${raw.length} bytes (expected 65)`);
  console.log(`  First byte: 0x${raw[0].toString(16)} (expected 0x04)`);
  return raw.length === 65 && raw[0] === 0x04;
}

console.log('\nValidating public key...');
const isValid = validateKey(keys.publicKey);
console.log(`  Valid ECDSA P-256? ${isValid ? 'YES ✓' : 'NO ✗'}`);

// Save to vapid.json
fs.writeFileSync('vapid.json', JSON.stringify({ publicKey: keys.publicKey, privateKey: keys.privateKey }, null, 2));
console.log('\n✓ Saved to vapid.json');

console.log('\nUse these as environment variables:');
console.log('  VAPID_PUBLIC_KEY=' + keys.publicKey);
console.log('  VAPID_PRIVATE_KEY=' + keys.privateKey);
