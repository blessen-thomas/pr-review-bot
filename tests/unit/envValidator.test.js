const test = require('node:test');
const assert = require('node:assert');
const { validateEnv, REQUIRED_ENV_VARS } = require('../../src/utils/envValidator');

test('validateEnv - returns true when all required variables are set', () => {
  const mockEnv = {
    GITHUB_APP_ID: '123456',
    GITHUB_APP_PRIVATE_KEY_PATH: './private-key.pem',
    GITHUB_WEBHOOK_SECRET: 'secret',
    GEMINI_API_KEY: 'api_key_value',
    REDIS_URL: 'redis://localhost:6379',
  };

  assert.strictEqual(validateEnv(mockEnv), true);
});

test('validateEnv - throws error listing missing variables when required vars are absent', () => {
  const mockEnv = {
    GITHUB_APP_ID: '123456',
    // Missing GITHUB_APP_PRIVATE_KEY_PATH and GEMINI_API_KEY
    GITHUB_WEBHOOK_SECRET: 'secret',
    REDIS_URL: 'redis://localhost:6379',
  };

  assert.throws(
    () => validateEnv(mockEnv),
    (err) => {
      assert.ok(err.message.includes('GITHUB_APP_PRIVATE_KEY_PATH'));
      assert.ok(err.message.includes('GEMINI_API_KEY'));
      assert.strictEqual(err.message.includes('secret'), false);
      assert.strictEqual(err.message.includes('123456'), false);
      return true;
    }
  );
});

test('validateEnv - throws error for empty or whitespace-only variables', () => {
  const mockEnv = {
    GITHUB_APP_ID: '  ',
    GITHUB_APP_PRIVATE_KEY_PATH: './key.pem',
    GITHUB_WEBHOOK_SECRET: 'secret',
    GEMINI_API_KEY: '',
    REDIS_URL: 'redis://localhost:6379',
  };

  assert.throws(
    () => validateEnv(mockEnv),
    (err) => {
      assert.ok(err.message.includes('GITHUB_APP_ID'));
      assert.ok(err.message.includes('GEMINI_API_KEY'));
      return true;
    }
  );
});

test('REQUIRED_ENV_VARS - contains the exact 5 core environment variables', () => {
  assert.deepStrictEqual(REQUIRED_ENV_VARS, [
    'GITHUB_APP_ID',
    'GITHUB_APP_PRIVATE_KEY_PATH',
    'GITHUB_WEBHOOK_SECRET',
    'GEMINI_API_KEY',
    'REDIS_URL',
  ]);
});
