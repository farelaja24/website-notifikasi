const webpush = require('web-push');

const keys = webpush.generateVAPIDKeys();
console.log('VAPID_PUBLIC_KEY=' + keys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);

console.log('\nUse these values as environment variables: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY');
