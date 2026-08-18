const REQUIRED_ENV_VARS = [
  'GITHUB_APP_ID',
  'GITHUB_APP_PRIVATE_KEY_PATH',
  'GITHUB_WEBHOOK_SECRET',
  'GEMINI_API_KEY',
  'REDIS_URL',
];

/**
 * Validates that all required environment variables are present and non-empty.
 * Fails fast with a descriptive Error listing missing variable names.
 * Never logs or exposes variable values.
 *
 * @param {Record<string, string|undefined>} [env=process.env]
 * @returns {boolean} true if all required environment variables are valid
 */
function validateEnv(env = process.env) {
  const missing = REQUIRED_ENV_VARS.filter(
    (key) => !env[key] || String(env[key]).trim() === ''
  );

  if (missing.length > 0) {
    const error = new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
    error.missingVars = missing;
    throw error;
  }

  return true;
}

module.exports = { validateEnv, REQUIRED_ENV_VARS };
