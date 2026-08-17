# Interface Contract: GitHub Webhook API

## Endpoint: `POST /webhook`

Receives GitHub `pull_request` webhook events.

### Headers

- `X-GitHub-Event`: Must equal `pull_request` (ignored otherwise).
- `X-Hub-Signature-256`: `sha256=<hex_hmac_signature>` (computed over raw request body using `GITHUB_WEBHOOK_SECRET`).

### Responses

- `202 Accepted` - Webhook payload valid & review job enqueued.
- `200 OK` - Webhook event ignored (e.g. non-PR action or unhandled event).
- `401 Unauthorized` - Missing or invalid HMAC-SHA256 signature.
- `500 Internal Server Error` - Redis connection failure or queue enqueue error.
