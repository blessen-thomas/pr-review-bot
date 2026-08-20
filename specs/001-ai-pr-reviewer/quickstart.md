# Quickstart: Testing AI PR Reviewer Bot

## Prerequisites

1. Node.js (>=18) installed.
2. Local Redis server running on default port `6379`.
3. Valid `.env` configuration file with:
   ```env
   GITHUB_APP_ID=123456
   GITHUB_WEBHOOK_SECRET=your_webhook_secret
   GEMINI_API_KEY=your_gemini_key
   MAX_DIFF_LINES=800
   MAX_REVIEWS_PER_REPO_PER_DAY=10
   DEDUPLICATION_TTL_SECONDS=86400
   ```

## Running locally

1. **Start Express Webhook Server**:
   ```bash
   npm start
   ```

2. **Start Queue Worker Process**:
   ```bash
   npm run worker
   ```

3. **Simulate Webhook**:
   Send a POST request to `http://localhost:3000/webhook` with header `X-GitHub-Event: pull_request` and valid `X-Hub-Signature-256`.
