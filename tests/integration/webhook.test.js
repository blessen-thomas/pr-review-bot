process.env.NODE_ENV = 'test';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const http = require('http');
const express = require('express');

const TEST_SECRET = 'test_webhook_secret_key_123';
let testServer;
let serverUrl;
let originalSecret;
let capturedJob = null;
let mockEnqueuedSet = new Set();
let shouldFailEnqueue = false;

// Inject mock queue module into require.cache to prevent live IORedis/BullMQ handles
const queuePath = require.resolve('../../src/queue/queue');
require.cache[queuePath] = {
  id: queuePath,
  filename: queuePath,
  loaded: true,
  exports: {
    enqueueReview: async (jobData) => {
      if (shouldFailEnqueue) {
        throw new Error('Queue connection failure');
      }
      const key = `${jobData.owner}/${jobData.repo}#${jobData.pullNumber}:${jobData.headSha}`;
      if (mockEnqueuedSet.has(key)) {
        return { deduplicated: true };
      }
      mockEnqueuedSet.add(key);
      capturedJob = jobData;
      return { id: 'mock-job-id', deduplicated: false };
    },
    connection: { disconnect: () => {} },
  },
};

const webhookRouter = require('../../src/routes/webhook');

function setupTestServer() {
  const app = express();
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use('/webhook', webhookRouter);

  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const url = `http://127.0.0.1:${port}`;
      resolve({ server, url });
    });
  });
}

function makePostRequest(serverUrl, path, headers, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, serverUrl);
    const req = http.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'Connection': 'close',
          ...headers,
        },
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => (responseBody += chunk));
        res.on('end', () => resolve({ statusCode: res.statusCode, body: responseBody }));
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function signPayload(bodyString, secret = TEST_SECRET) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(bodyString).digest('hex');
}

before(async () => {
  originalSecret = process.env.GITHUB_WEBHOOK_SECRET;
  process.env.GITHUB_WEBHOOK_SECRET = TEST_SECRET;

  const res = await setupTestServer();
  testServer = res.server;
  serverUrl = res.url;
});

after(() => {
  process.env.GITHUB_WEBHOOK_SECRET = originalSecret;
  if (testServer) {
    testServer.close();
  }
});

test('POST /webhook - valid pull_request.opened enqueues job and returns HTTP 202', async () => {
  capturedJob = null;
  shouldFailEnqueue = false;

  const payload = JSON.stringify({
    action: 'opened',
    installation: { id: 999 },
    repository: { name: 'test-repo', owner: { login: 'test-owner' } },
    pull_request: { number: 42, head: { sha: 'abcdef123456' } },
  });

  const headers = {
    'X-GitHub-Event': 'pull_request',
    'X-Hub-Signature-256': signPayload(payload),
  };

  const res = await makePostRequest(serverUrl, '/webhook', headers, payload);

  assert.strictEqual(res.statusCode, 202);
  assert.strictEqual(res.body, 'queued');
  assert.deepStrictEqual(capturedJob, {
    installationId: 999,
    owner: 'test-owner',
    repo: 'test-repo',
    pullNumber: 42,
    headSha: 'abcdef123456',
  });
});

test('POST /webhook - returns HTTP 401 for invalid signature', async () => {
  const payload = JSON.stringify({ action: 'opened' });
  const headers = {
    'X-GitHub-Event': 'pull_request',
    'X-Hub-Signature-256': 'sha256=invalid_signature_hash',
  };

  const res = await makePostRequest(serverUrl, '/webhook', headers, payload);
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.body, 'invalid signature');
});

test('POST /webhook - returns HTTP 401 for missing signature header', async () => {
  const payload = JSON.stringify({ action: 'opened' });
  const headers = {
    'X-GitHub-Event': 'pull_request',
  };

  const res = await makePostRequest(serverUrl, '/webhook', headers, payload);
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.body, 'invalid signature');
});

test('POST /webhook - returns HTTP 200 ignored for non-pull_request events', async () => {
  capturedJob = null;
  shouldFailEnqueue = false;

  const payload = JSON.stringify({ ref: 'refs/heads/main' });
  const headers = {
    'X-GitHub-Event': 'push',
    'X-Hub-Signature-256': signPayload(payload),
  };

  const res = await makePostRequest(serverUrl, '/webhook', headers, payload);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body, 'ignored');
  assert.strictEqual(capturedJob, null);
});

test('POST /webhook - returns HTTP 200 ignored for irrelevant PR actions (e.g. closed)', async () => {
  capturedJob = null;
  shouldFailEnqueue = false;

  const payload = JSON.stringify({ action: 'closed' });
  const headers = {
    'X-GitHub-Event': 'pull_request',
    'X-Hub-Signature-256': signPayload(payload),
  };

  const res = await makePostRequest(serverUrl, '/webhook', headers, payload);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body, 'ignored');
  assert.strictEqual(capturedJob, null);
});

test('POST /webhook - returns HTTP 500 when queueing fails', async () => {
  capturedJob = null;
  shouldFailEnqueue = true;

  const payload = JSON.stringify({
    action: 'synchronize',
    installation: { id: 100 },
    repository: { name: 'my-repo', owner: { login: 'my-owner' } },
    pull_request: { number: 7, head: { sha: '112233' } },
  });

  const headers = {
    'X-GitHub-Event': 'pull_request',
    'X-Hub-Signature-256': signPayload(payload),
  };

  const res = await makePostRequest(serverUrl, '/webhook', headers, payload);
  assert.strictEqual(res.statusCode, 500);
  assert.strictEqual(res.body, 'failed to queue review');
});

test('POST /webhook - duplicate webhook event returns HTTP 200 deduplicated', async () => {
  capturedJob = null;
  shouldFailEnqueue = false;
  mockEnqueuedSet.clear();

  const payload = JSON.stringify({
    action: 'opened',
    installation: { id: 500 },
    repository: { name: 'dedup-repo', owner: { login: 'dedup-owner' } },
    pull_request: { number: 12, head: { sha: 'commit_sha_123' } },
  });

  const headers = {
    'X-GitHub-Event': 'pull_request',
    'X-Hub-Signature-256': signPayload(payload),
  };

  const res1 = await makePostRequest(serverUrl, '/webhook', headers, payload);
  assert.strictEqual(res1.statusCode, 202);
  assert.strictEqual(res1.body, 'queued');

  const res2 = await makePostRequest(serverUrl, '/webhook', headers, payload);
  assert.strictEqual(res2.statusCode, 200);
  assert.strictEqual(res2.body, 'deduplicated');
});

test('POST /webhook - same PR with a new commit is accepted and queued', async () => {
  capturedJob = null;
  shouldFailEnqueue = false;
  mockEnqueuedSet.clear();

  const payload1 = JSON.stringify({
    action: 'opened',
    installation: { id: 500 },
    repository: { name: 'dedup-repo', owner: { login: 'dedup-owner' } },
    pull_request: { number: 12, head: { sha: 'commit_sha_1' } },
  });

  const payload2 = JSON.stringify({
    action: 'synchronize',
    installation: { id: 500 },
    repository: { name: 'dedup-repo', owner: { login: 'dedup-owner' } },
    pull_request: { number: 12, head: { sha: 'commit_sha_2' } },
  });

  const res1 = await makePostRequest(serverUrl, '/webhook', {
    'X-GitHub-Event': 'pull_request',
    'X-Hub-Signature-256': signPayload(payload1),
  }, payload1);
  assert.strictEqual(res1.statusCode, 202);

  const res2 = await makePostRequest(serverUrl, '/webhook', {
    'X-GitHub-Event': 'pull_request',
    'X-Hub-Signature-256': signPayload(payload2),
  }, payload2);
  assert.strictEqual(res2.statusCode, 202);
  assert.strictEqual(res2.body, 'queued');
  assert.strictEqual(capturedJob.headSha, 'commit_sha_2');
});
