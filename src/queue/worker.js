require('dotenv').config();
const { Worker } = require('bullmq');
const { connection } = require('./queue');
const { parseValidDiffLines, filterFindings } = require('../utils/diffParser');
const { getInstallationClient, getPullRequestDiff, postReview, postSummaryReview } = require('../services/github');
const { reviewDiff } = require('../services/aiReviewer');
const { canReview, recordReview } = require('../utils/rateLimiter');

function diffLineCount(diff) {
  return diff.split('\n').filter((l) => l.startsWith('+') || l.startsWith('-')).length;
}

function buildSummaryMarkdown(findings, title) {
  let markdown = `${title}\n\n`;
  markdown += '| File | Line | Severity | Finding |\n';
  markdown += '| --- | --- | --- | --- |\n';
  for (const f of findings) {
    const lineStr = typeof f.line === 'number' ? f.line : 'N/A';
    markdown += `| \`${f.file || 'General'}\` | ${lineStr} | **${f.severity || 'info'}** | ${f.comment} |\n`;
  }
  return markdown;
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

    const validLinesMap = parseValidDiffLines(diff);
    const findings = await reviewDiff(diff);
    recordReview(owner, repo);

    if (findings.length === 0) {
      console.log(`No findings for ${owner}/${repo}#${pullNumber}`);
      return { findings: 0 };
    }

    const { validInlineFindings, invalidInlineFindings } = filterFindings(findings, validLinesMap);

    if (validInlineFindings.length > 0) {
      let body = `Automated AI Review — ${findings.length} finding(s) total (${validInlineFindings.length} inline).`;
      if (invalidInlineFindings.length > 0) {
        body += '\n\n' + buildSummaryMarkdown(invalidInlineFindings, '### Additional Findings (Outside Diff Hunks)');
      }

      try {
        await postReview(octokit, {
          owner,
          repo,
          pullNumber,
          headSha,
          body,
          comments: validInlineFindings.map((f) => ({
            path: f.file,
            line: f.line,
            body: `**[${f.severity || 'info'}]** ${f.comment}`,
          })),
        });
      } catch (err) {
        if (err.status === 422 || (err.message && err.message.includes('422'))) {
          console.warn(`Inline review failed with HTTP 422 for ${owner}/${repo}#${pullNumber}. Falling back to summary review.`);
          const fallbackBody = buildSummaryMarkdown(
            findings,
            `Automated AI Review (Summary Fallback) — ${findings.length} finding(s).\n\n*Note: Inline comment creation was rejected by GitHub for one or more positions.*`
          );
          await postSummaryReview(octokit, {
            owner,
            repo,
            pullNumber,
            headSha,
            body: fallbackBody,
          });
        } else {
          throw err;
        }
      }
    } else {
      // No valid inline positions exist; post a top-level PR summary
      const fallbackBody = buildSummaryMarkdown(
        findings,
        `Automated AI Review — ${findings.length} finding(s).\n\n*Note: Findings are for lines outside changed diff hunks and are posted as a summary.*`
      );
      await postSummaryReview(octokit, {
        owner,
        repo,
        pullNumber,
        headSha,
        body: fallbackBody,
      });
    }

    return { findings: findings.length, inline: validInlineFindings.length };
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
