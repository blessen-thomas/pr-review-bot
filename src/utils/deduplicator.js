/**
 * Generates the deterministic Redis key for a PR review deduplication lock.
 * Scoped by repository (owner/repo), PR number, and head SHA.
 *
 * @param {string|object} ownerOrJobData - Owner string or object containing owner, repo, pullNumber, headSha
 * @param {string} [repo]
 * @param {number|string} [pullNumber]
 * @param {string} [headSha]
 * @returns {string} Redis key formatted as dedup:{owner}/{repo}:{pullNumber}:{headSha}
 */
function getDedupKey(ownerOrJobData, repo, pullNumber, headSha) {
  let owner = ownerOrJobData;
  if (typeof ownerOrJobData === 'object' && ownerOrJobData !== null) {
    ({ owner, repo, pullNumber, headSha } = ownerOrJobData);
  }
  return `dedup:${owner}/${repo}:${pullNumber}:${headSha}`;
}

/**
 * Returns configured TTL in seconds for deduplication keys.
 * Defaults to 86400 seconds (24 hours).
 *
 * @param {Record<string, string|undefined>} [env=process.env]
 * @returns {number}
 */
function getDedupTTL(env = process.env) {
  const raw = env.DEDUPLICATION_TTL_SECONDS || env.DEDUPLICATION_TTL;
  if (!raw) return 86400;
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) || parsed <= 0 ? 86400 : parsed;
}

/**
 * Atomically acquires a deduplication lock in Redis using SET EX NX.
 *
 * @param {object} redis - IORedis client instance
 * @param {object} jobData - { owner, repo, pullNumber, headSha }
 * @param {number} [ttlSeconds]
 * @returns {Promise<boolean>} true if lock acquired (first review for commit), false if duplicate
 */
async function acquireDedupLock(redis, jobData, ttlSeconds = getDedupTTL()) {
  const key = getDedupKey(jobData);
  const result = await redis.set(key, 'pending', 'EX', ttlSeconds, 'NX');
  return result === 'OK';
}

/**
 * Marks a review as completed in Redis, maintaining the TTL.
 *
 * @param {object} redis - IORedis client instance
 * @param {object} jobData - { owner, repo, pullNumber, headSha }
 * @param {number} [ttlSeconds]
 * @returns {Promise<void>}
 */
async function markDedupComplete(redis, jobData, ttlSeconds = getDedupTTL()) {
  const key = getDedupKey(jobData);
  await redis.set(key, 'completed', 'EX', ttlSeconds);
}

/**
 * Releases/deletes the deduplication key from Redis (e.g. on permanent job failure).
 *
 * @param {object} redis - IORedis client instance
 * @param {object} jobData - { owner, repo, pullNumber, headSha }
 * @returns {Promise<void>}
 */
async function releaseDedupLock(redis, jobData) {
  const key = getDedupKey(jobData);
  await redis.del(key);
}

module.exports = {
  getDedupKey,
  getDedupTTL,
  acquireDedupLock,
  markDedupComplete,
  releaseDedupLock,
};
