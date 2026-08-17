const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const webhookRouter = require('../../src/routes/webhook');

test('verifySignature - valid signature returns true', () => {
  const secret = 'my_secret';
  process.env.GITHUB_WEBHOOK_SECRET = secret;

  const rawBody = Buffer.from(JSON.stringify({ action: 'opened' }));
  const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  const req = {
    rawBody,
    get: (header) => (header.toLowerCase() === 'x-hub-signature-256' ? signature : null),
  };

  assert.strictEqual(webhookRouter.verifySignature(req), true);
});

test('verifySignature - invalid signature returns false', () => {
  process.env.GITHUB_WEBHOOK_SECRET = 'my_secret';

  const req = {
    rawBody: Buffer.from('test payload'),
    get: (header) => (header.toLowerCase() === 'x-hub-signature-256' ? 'sha256=invalid_signature' : null),
  };

  assert.strictEqual(webhookRouter.verifySignature(req), false);
});
