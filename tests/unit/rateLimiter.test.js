const test = require('node:test');
const assert = require('node:assert');
const { canReview, recordReview } = require('../../src/utils/rateLimiter');

test('rateLimiter - respects daily review limit', () => {
  process.env.MAX_REVIEWS_PER_REPO_PER_DAY = '2';
  const owner = 'test-owner';
  const repo = 'test-repo';

  assert.strictEqual(canReview(owner, repo), true);
  recordReview(owner, repo);
  assert.strictEqual(canReview(owner, repo), true);
  recordReview(owner, repo);
  assert.strictEqual(canReview(owner, repo), false);
});
