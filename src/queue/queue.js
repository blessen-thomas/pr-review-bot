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

async function enqueueReview(jobData, customOptions = {}) {
  const options = { ...DEFAULT_JOB_OPTIONS, ...customOptions };
  return reviewQueue.add('review-pr', jobData, options);
}

module.exports = { reviewQueue, connection, enqueueReview, DEFAULT_JOB_OPTIONS };
