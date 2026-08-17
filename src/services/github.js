const fs = require('fs');
const { Octokit } = require('@octokit/rest');
const { createAppAuth } = require('@octokit/auth-app');

function loadPrivateKey() {
  const path = process.env.GITHUB_APP_PRIVATE_KEY_PATH;
  return fs.readFileSync(path, 'utf8');
}

// Returns an Octokit instance authenticated as a specific installation
// (i.e. scoped to the repos that installed the GitHub App).
async function getInstallationClient(installationId) {
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: process.env.GITHUB_APP_ID,
      privateKey: loadPrivateKey(),
      installationId,
    },
  });
}

// Fetches the unified diff for a PR as plain text.
async function getPullRequestDiff(octokit, { owner, repo, pullNumber }) {
  const { data } = await octokit.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
    mediaType: { format: 'diff' },
  });
  // With mediaType diff, Octokit returns the raw diff string in `data`.
  return typeof data === 'string' ? data : String(data);
}

// Posts a PR review with inline comments.
// comments: [{ path, line, body }]
async function postReview(octokit, { owner, repo, pullNumber, headSha, body, comments }) {
  return octokit.pulls.createReview({
    owner,
    repo,
    pull_number: pullNumber,
    commit_id: headSha,
    event: 'COMMENT',
    body,
    comments: comments.map((c) => ({
      path: c.path,
      line: c.line,
      body: c.body,
    })),
  });
}

module.exports = { getInstallationClient, getPullRequestDiff, postReview };
