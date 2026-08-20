# pr-review-bot

A GitHub App that automatically reviews pull requests using the Gemini API
(free tier) and posts inline comments as a real PR review.

## Architecture

```
GitHub PR event --> webhook (Express, HMAC-verified)
                       |
                       v
                 BullMQ queue (Redis)
                       |
                       v
                    worker  --> Octokit: fetch diff
                       |    --> aiReviewer.js: send diff, get findings
                       |    --> Octokit: post review comments
```

The AI call is isolated in `src/services/aiReviewer.js` as a thin adapter —
`reviewDiff(diff) -> [{ file, line, severity, comment }]`. Swapping providers
(e.g. to Claude) later only means rewriting that one file.

## Setup

1. **Create a GitHub App**
   - Permissions: Pull requests (Read & write), Contents (Read-only)
   - Subscribe to event: `pull_request`
   - Generate a private key, save it as `private-key.pem` in the project root
   - Note the App ID and generate a webhook secret

2. **Get a free Gemini API key** at Google AI Studio (no card required)

3. **Install Redis locally** (or use a free Redis instance from Render/Railway)

4. **Configure environment**
   ```
   cp .env.example .env
   # fill in GITHUB_APP_ID, GITHUB_WEBHOOK_SECRET, GEMINI_API_KEY, etc.
   ```

5. **Install dependencies**
   ```
   npm install
   ```

6. **Run**
   ```
   npm start     # webhook server
   npm run worker  # queue worker, separate process
   ```

7. **Expose locally for testing** with a tunnel (e.g. `ngrok http 3000`) and
   point the GitHub App's webhook URL at `<tunnel-url>/webhook`.

## Cost / reliability guardrails

- `MAX_DIFF_LINES` — skips oversized diffs instead of sending them to the API
- `MAX_REVIEWS_PER_REPO_PER_DAY` — in-memory cap per repo, resets daily
- `DEDUPLICATION_TTL_SECONDS` — Redis-backed PR commit deduplication (default: 86400s / 24h) preventing duplicate review processing for identical PR commits
- BullMQ retries failed jobs (e.g. transient API errors) with backoff instead
  of dropping them silently

## Build order (for reference while developing)

1. Express server + webhook signature verification ✅
2. Fetch a diff with a hardcoded installation token, print it
3. Add Gemini call with a basic prompt, print the review
4. Split into queue + worker ✅
5. Structured output parsing + posting back as a real PR review ✅
6. Polish: rate-limit handling, error cases, review history
