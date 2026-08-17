const test = require('node:test');
const assert = require('node:assert');
const { postReview, postSummaryReview } = require('../../src/services/github');

test('postReview - handles optional comments parameter for summary posting', async () => {
  let capturedParams = null;
  const mockOctokit = {
    pulls: {
      createReview: async (params) => {
        capturedParams = params;
        return { data: { id: 123 } };
      },
    },
  };

  await postReview(mockOctokit, {
    owner: 'test-owner',
    repo: 'test-repo',
    pullNumber: 1,
    headSha: 'abc1234',
    body: 'Summary body test',
    comments: [],
  });

  assert.strictEqual(capturedParams.owner, 'test-owner');
  assert.strictEqual(capturedParams.body, 'Summary body test');
  assert.strictEqual(capturedParams.comments, undefined);
});

test('postSummaryReview - posts top-level review without inline comments', async () => {
  let capturedParams = null;
  const mockOctokit = {
    pulls: {
      createReview: async (params) => {
        capturedParams = params;
        return { data: { id: 456 } };
      },
    },
  };

  await postSummaryReview(mockOctokit, {
    owner: 'test-owner',
    repo: 'test-repo',
    pullNumber: 2,
    headSha: 'def5678',
    body: 'Top-level fallback summary',
  });

  assert.strictEqual(capturedParams.pull_number, 2);
  assert.strictEqual(capturedParams.body, 'Top-level fallback summary');
  assert.strictEqual(capturedParams.comments, undefined);
});
