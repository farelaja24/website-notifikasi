const key = 'BCLbXyFS8PjZcC4FU7psBoHe3Ud8SY5Jt7JGxLWTBSV5jZKBsXlz5mweS7azS3y_zuJp7EVX0pqMU_8dUjW7Mbk';
const padding = '='.repeat((4 - key.length % 4) % 4);
const base64 = (key + padding).replace(/-/g, '+').replace(/_/g, '/');
const raw = Buffer.from(base64, 'base64');
console.log('Key:', key);
console.log('Decoded length (bytes):', raw.length);
console.log('First byte:', '0x' + raw[0].toString(16));
console.log('Expected: 0x04 (uncompressed point) and 65 bytes total for ECDSA P-256');
console.log('Match?', raw.length === 65 && raw[0] === 0x04);
