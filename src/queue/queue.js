const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableOfflineQueue: true,
});

connection.on('error', (err) => {
  if (process.env.NODE_ENV !== 'test') {
    console.error('Redis connection error:', err.message);
  }
});

const reviewQueue = new Queue('pr-reviews', { connection });

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 3000,
  },
  removeOnComplete: { age: 86400, count: 100 },
  removeOnFail: { age: 604800, count: 500 },
};

const { acquireDedupLock, releaseDedupLock } = require('../utils/deduplicator');

async function enqueueReview(jobData, customOptions = {}) {
  const lockAcquired = await acquireDedupLock(connection, jobData);
  if (!lockAcquired) {
    return { deduplicated: true };
  }

  try {
    const options = { ...DEFAULT_JOB_OPTIONS, ...customOptions };
    const job = await reviewQueue.add('review-pr', jobData, options);
    return { ...job, id: job?.id, deduplicated: false };
  } catch (err) {
    await releaseDedupLock(connection, jobData);
    throw err;
  }
}

module.exports = { reviewQueue, connection, enqueueReview, DEFAULT_JOB_OPTIONS };
