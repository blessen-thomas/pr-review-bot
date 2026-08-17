require('dotenv').config();
const { Worker } = require('bullmq');
const { connection } = require('./queue');
const { getInstallationClient, getPullRequestDiff, postReview } = require('../services/github');
const { reviewDiff } = require('../services/aiReviewer');
const { canReview, recordReview } = require('../utils/rateLimiter');

function diffLineCount(diff) {
  return diff.split('\n').filter((l) => l.startsWith('+') || l.startsWith('-')).length;
}

const worker = new Worker(
  'pr-reviews',
  async (job) => {
    const { installationId, owner, repo, pullNumber, headSha } = job.data;

    if (!canReview(owner, repo)) {
      console.log(`Skipping ${owner}/${repo}#${pullNumber}: daily review cap reached`);
      return { skipped: 'daily-cap' };
    }

    const octokit = await getInstallationClient(installationId);
    const diff = await getPullRequestDiff(octokit, { owner, repo, pullNumber });

    const maxLines = Number(process.env.MAX_DIFF_LINES || 800);
    if (diffLineCount(diff) > maxLines) {
      console.log(`Skipping ${owner}/${repo}#${pullNumber}: diff exceeds ${maxLines} changed lines`);
      return { skipped: 'diff-too-large' };
    }

    const findings = await reviewDiff(diff);
    recordReview(owner, repo);

    if (findings.length === 0) {
      console.log(`No findings for ${owner}/${repo}#${pullNumber}`);
      return { findings: 0 };
    }

    await postReview(octokit, {
      owner,
      repo,
      pullNumber,
      headSha,
      body: `Automated review — ${findings.length} finding(s).`,
      comments: findings.map((f) => ({
        path: f.file,
        line: f.line,
        body: `**[${f.severity || 'info'}]** ${f.comment}`,
      })),
    });

    return { findings: findings.length };
  },
  { connection }
);

worker.on('completed', (job, result) => {
  console.log(`Job ${job.id} done:`, result);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

console.log('Worker started, waiting for review jobs...');
