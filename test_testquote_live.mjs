// Test testQuote Procedure mit echtem JWT-Token
import { createHmac } from 'crypto';
import http from 'http';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const OWNER_OPEN_ID = process.env.OWNER_OPEN_ID || 'test';
console.log('JWT_SECRET available:', !!process.env.JWT_SECRET);
console.log('OWNER_OPEN_ID:', OWNER_OPEN_ID.slice(0,10) + '...');

// Einfaches JWT erstellen (HS256)
function base64url(str) {
  return Buffer.from(str).toString('base64url');
}
function sign(header, payload, secret) {
  const data = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const sig = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

// JWT muss nur { openId } enthalten – so wie createSessionToken() es macht
const token = sign(
  { alg: 'HS256', typ: 'JWT' },
  { openId: OWNER_OPEN_ID, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 },
  JWT_SECRET
);

console.log('JWT created, calling testQuote...');

const body = JSON.stringify({ 0: { json: {} } });
const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/trpc/contentBot.testQuote?batch=1',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Cookie': `app_session_id=${token}`,
    'Content-Length': Buffer.byteLength(body)
  }
}, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try {
      const parsed = JSON.parse(data);
      if (parsed[0]?.result) {
        console.log('SUCCESS:', JSON.stringify(parsed[0].result.data, null, 2));
      } else if (parsed[0]?.error) {
        console.log('ERROR:', parsed[0].error.json?.message);
        console.log('STACK:', parsed[0].error.json?.data?.stack?.split('\n').slice(0,5).join('\n'));
      }
    } catch {
      console.log('Raw:', data.slice(0, 500));
    }
  });
});
req.write(body);
req.end();
