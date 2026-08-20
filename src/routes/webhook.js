const express = require('express');
const crypto = require('crypto');
const { enqueueReview } = require('../queue/queue');

const router = express.Router();

function verifySignature(req) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  const signature = req.get('x-hub-signature-256');
  if (!secret || !signature || !req.rawBody) return false;

  const expected =
    'sha256=' +
    crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');

  // timingSafeEqual requires equal-length buffers
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

router.post('/', async (req, res) => {
  if (!verifySignature(req)) {
    console.warn('Rejected webhook: bad signature');
    return res.status(401).send('invalid signature');
  }

  const event = req.get('x-github-event');
  const payload = req.body;

  // We only care about PRs being opened or updated with new commits.
  const relevantActions = ['opened', 'synchronize', 'reopened'];
  if (event !== 'pull_request' || !relevantActions.includes(payload.action)) {
    return res.status(200).send('ignored');
  }

  try {
    const result = await enqueueReview({
      installationId: payload.installation?.id,
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      pullNumber: payload.pull_request.number,
      headSha: payload.pull_request.head.sha,
    });
    if (result && result.deduplicated) {
      return res.status(200).send('deduplicated');
    }
    res.status(202).send('queued');
  } catch (err) {
    console.error('Failed to enqueue review job:', err);
    res.status(500).send('failed to queue review');
  }
});

router.verifySignature = verifySignature;
module.exports = router;
