const test = require('node:test');
const assert = require('node:assert');
const {
  getDedupKey,
  getDedupTTL,
  acquireDedupLock,
  markDedupComplete,
  releaseDedupLock,
} = require('../../src/utils/deduplicator');

function createMockRedis() {
  const store = new Map();

  return {
    store,
    async set(key, value, mode1, ttl, mode2) {
      const now = Date.now();
      const existing = store.get(key);
      if (existing && existing.expiryTime && existing.expiryTime <= now) {
        store.delete(key);
      }
      if (mode2 === 'NX' && store.has(key)) {
        return null;
      }
      const expiryTime = mode1 === 'EX' ? now + ttl * 1000 : null;
      store.set(key, { value, expiryTime });
      return 'OK';
    },
    async del(key) {
      const deleted = store.has(key);
      store.delete(key);
      return deleted ? 1 : 0;
    },
    async get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiryTime && entry.expiryTime <= Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
  };
}

test('deduplication key format - generates expected key from positional args and object', () => {
  const keyFromArgs = getDedupKey('octocat', 'hello-world', 42, 'abc123456');
  assert.strictEqual(keyFromArgs, 'dedup:octocat/hello-world:42:abc123456');

  const keyFromObj = getDedupKey({
    owner: 'octocat',
    repo: 'hello-world',
    pullNumber: 42,
    headSha: 'abc123456',
  });
  assert.strictEqual(keyFromObj, 'dedup:octocat/hello-world:42:abc123456');
});

test('TTL configuration - reads DEDUPLICATION_TTL_SECONDS with default fallback', () => {
  assert.strictEqual(getDedupTTL({ DEDUPLICATION_TTL_SECONDS: '3600' }), 3600);
  assert.strictEqual(getDedupTTL({ DEDUPLICATION_TTL: '1800' }), 1800);
  assert.strictEqual(getDedupTTL({}), 86400);
  assert.strictEqual(getDedupTTL({ DEDUPLICATION_TTL_SECONDS: 'invalid' }), 86400);
  assert.strictEqual(getDedupTTL({ DEDUPLICATION_TTL_SECONDS: '-10' }), 86400);
});

test('acquireDedupLock - first review for a PR commit is accepted', async () => {
  const redis = createMockRedis();
  const jobData = { owner: 'owner', repo: 'repo', pullNumber: 1, headSha: 'sha1' };

  const acquired = await acquireDedupLock(redis, jobData, 3600);
  assert.strictEqual(acquired, true);
  assert.strictEqual(await redis.get('dedup:owner/repo:1:sha1'), 'pending');
});

test('acquireDedupLock - identical duplicate review is rejected/deduplicated', async () => {
  const redis = createMockRedis();
  const jobData = { owner: 'owner', repo: 'repo', pullNumber: 1, headSha: 'sha1' };

  const first = await acquireDedupLock(redis, jobData, 3600);
  assert.strictEqual(first, true);

  const duplicate = await acquireDedupLock(redis, jobData, 3600);
  assert.strictEqual(duplicate, false);
});

test('acquireDedupLock - different head SHA is accepted', async () => {
  const redis = createMockRedis();
  const commit1 = { owner: 'owner', repo: 'repo', pullNumber: 1, headSha: 'sha1' };
  const commit2 = { owner: 'owner', repo: 'repo', pullNumber: 1, headSha: 'sha2' };

  assert.strictEqual(await acquireDedupLock(redis, commit1), true);
  assert.strictEqual(await acquireDedupLock(redis, commit2), true);
});

test('acquireDedupLock - different PR number is accepted', async () => {
  const redis = createMockRedis();
  const pr1 = { owner: 'owner', repo: 'repo', pullNumber: 1, headSha: 'sha1' };
  const pr2 = { owner: 'owner', repo: 'repo', pullNumber: 2, headSha: 'sha1' };

  assert.strictEqual(await acquireDedupLock(redis, pr1), true);
  assert.strictEqual(await acquireDedupLock(redis, pr2), true);
});

test('acquireDedupLock - different repository is accepted', async () => {
  const redis = createMockRedis();
  const repoA = { owner: 'owner', repo: 'repoA', pullNumber: 1, headSha: 'sha1' };
  const repoB = { owner: 'owner', repo: 'repoB', pullNumber: 1, headSha: 'sha1' };

  assert.strictEqual(await acquireDedupLock(redis, repoA), true);
  assert.strictEqual(await acquireDedupLock(redis, repoB), true);
});

test('concurrent duplicate requests - only one request acquires lock', async () => {
  const redis = createMockRedis();
  const jobData = { owner: 'owner', repo: 'repo', pullNumber: 5, headSha: 'shaConcurrent' };

  const results = await Promise.all(
    Array.from({ length: 10 }).map(() => acquireDedupLock(redis, jobData))
  );

  const successCount = results.filter(Boolean).length;
  assert.strictEqual(successCount, 1);
});

test('markDedupComplete and releaseDedupLock - updates state and releases on failure', async () => {
  const redis = createMockRedis();
  const jobData = { owner: 'owner', repo: 'repo', pullNumber: 1, headSha: 'sha1' };

  await acquireDedupLock(redis, jobData);
  assert.strictEqual(await redis.get('dedup:owner/repo:1:sha1'), 'pending');

  await markDedupComplete(redis, jobData);
  assert.strictEqual(await redis.get('dedup:owner/repo:1:sha1'), 'completed');

  await releaseDedupLock(redis, jobData);
  assert.strictEqual(await redis.get('dedup:owner/repo:1:sha1'), null);

  // Can acquire again after release
  assert.strictEqual(await acquireDedupLock(redis, jobData), true);
});
