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

async function enqueueReview(jobData) {
  return reviewQueue.add('review-pr', jobData, {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  });
}

module.exports = { reviewQueue, connection, enqueueReview };
