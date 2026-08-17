# Research Findings: AI PR Reviewer Bot

## 1. Provider Adapter & Gemini Prompting

- **Decision**: Isolate Gemini API interaction in `src/services/aiReviewer.js` exporting `reviewDiff(diff)`.
- **Rationale**: Keeps LLM provider completely decoupled from Express webhooks and BullMQ workers. Swapping providers (e.g. to Claude or OpenAI) only requires updating `aiReviewer.js`.
- **Alternatives Considered**: Direct LLM calls inside worker process (rejected due to tight coupling and poor testability).

## 2. Queue Architecture & Retry Policy

- **Decision**: Use BullMQ over `ioredis` with exponential backoff (`attempts: 3`, `backoff: { type: 'exponential', delay: 2000 }`).
- **Rationale**: BullMQ handles queue persistence, concurrency, and worker failure retries automatically, preventing webhook drop-offs during transient API outages.
- **Alternatives Considered**: In-memory JavaScript arrays/events (rejected due to message loss on server restart and lack of retries).

## 3. Webhook Signature Verification

- **Decision**: Capture raw request buffer in Express (`express.json({ verify: (req, res, buf) => req.rawBody = buf })`) and perform HMAC-SHA256 verification using `crypto.timingSafeEqual`.
- **Rationale**: Prevents timing side-channel attacks and ensures only legitimate GitHub webhook events trigger queue jobs.
- **Alternatives Considered**: Standard string comparison (rejected due to timing vulnerability).

## 4. Rate Limiting & Guardrail Mechanics

- **Decision**: Enforce line count inspection (`diffLineCount(diff) <= MAX_DIFF_LINES`) and daily repo tracking in `src/utils/rateLimiter.js`.
- **Rationale**: Protects free-tier Gemini API quotas and prevents worker memory bloat from massive diffs.
- **Alternatives Considered**: Uncapped processing (rejected due to cost & API quota risk).
