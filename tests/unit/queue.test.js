const test = require('node:test');
const assert = require('node:assert');
const { DEFAULT_JOB_OPTIONS, connection } = require('../../src/queue/queue');

test.after(() => {
  connection.disconnect();
});

test('DEFAULT_JOB_OPTIONS - configures 3 attempts with exponential backoff', () => {
  assert.strictEqual(DEFAULT_JOB_OPTIONS.attempts, 3);
  assert.strictEqual(DEFAULT_JOB_OPTIONS.backoff.type, 'exponential');
  assert.strictEqual(DEFAULT_JOB_OPTIONS.backoff.delay, 3000);
});

test('DEFAULT_JOB_OPTIONS - retains completed and failed job history bounds', () => {
  assert.deepStrictEqual(DEFAULT_JOB_OPTIONS.removeOnComplete, { age: 86400, count: 100 });
  assert.deepStrictEqual(DEFAULT_JOB_OPTIONS.removeOnFail, { age: 604800, count: 500 });
});
