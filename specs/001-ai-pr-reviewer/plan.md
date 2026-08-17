# Implementation Plan: AI PR Reviewer Bot

**Branch**: `001-ai-pr-reviewer` | **Date**: 2026-08-17 | **Spec**: [spec.md](file:///d:/Downloads/pr-review-bot_1/pr-review-bot/specs/001-ai-pr-reviewer/spec.md)

**Input**: Feature specification from [`specs/001-ai-pr-reviewer/spec.md`](file:///d:/Downloads/pr-review-bot_1/pr-review-bot/specs/001-ai-pr-reviewer/spec.md)

## Summary

The AI PR Reviewer Bot is a GitHub App that receives `pull_request` webhooks via an Express server, validates HMAC-SHA256 signatures, enqueues work into a Redis/BullMQ job queue, and uses an isolated Gemini AI adapter (`src/services/aiReviewer.js`) to parse diffs and post structured inline review comments back to GitHub via Octokit.

## Technical Context

**Language/Version**: Node.js (>=18), CommonJS (`"type": "commonjs"`)

**Primary Dependencies**: `express` (v4), `bullmq` (v5), `ioredis` (v5), `@google/generative-ai` (v0.21), `@octokit/rest` (v21), `@octokit/auth-app` (v7), `dotenv` (v16)

**Storage**: Redis (BullMQ queue state & in-memory rate limiting)

**Testing**: Webhook simulation scripts, manual integration validation, unit tests for diff parsing and signature verification

**Target Platform**: Node.js server environment / cloud container

**Project Type**: Web service (Express webhook listener) + background queue worker process

**Performance Goals**: Webhook ingestion response time < 200ms; end-to-end review completion < 15 seconds

**Constraints**: Gemini API free-tier rate limits, `MAX_DIFF_LINES` cap (default 800), `MAX_REVIEWS_PER_REPO_PER_DAY` cap

**Scale/Scope**: Asynchronous queue execution, per-repo rate limiting

## Constitution Check

*GATE: Passed prior to Phase 0 research & Phase 1 design.*

- **Principle I (Thin Adapter AI Architecture)**: ✅ `aiReviewer.js` isolates LLM calls completely; signature `reviewDiff(diff) -> findings` maintained.
- **Principle II (Asynchronous Queue Processing)**: ✅ Express webhook immediately enqueues to BullMQ and responds HTTP 202; heavy diff/AI work runs in `src/queue/worker.js`.
- **Principle III (Webhook Security)**: ✅ Raw buffer signature validation via HMAC-SHA256 enforced in `src/routes/webhook.js`.
- **Principle IV (Operational Guardrails)**: ✅ `MAX_DIFF_LINES` and `MAX_REVIEWS_PER_REPO_PER_DAY` checked before invoking AI provider.
- **Principle V (Structured Output & Inline Review)**: ✅ Schema (`file`, `line`, `severity`, `comment`) enforced before posting inline comments via Octokit.

## Project Structure

### Documentation (this feature)

```text
specs/001-ai-pr-reviewer/
├── plan.md              # Implementation plan
├── research.md          # Phase 0 research findings
├── data-model.md        # Phase 1 data entities and schemas
├── quickstart.md        # Testing and execution guide
├── contracts/           # API and module contracts
│   ├── webhook-api.md
│   └── ai-reviewer-contract.md
└── checklists/
    └── requirements.md  # Specification checklist
```

### Source Code (repository root)

```text
src/
├── index.js             # Express server entry point
├── routes/
│   └── webhook.js       # GitHub webhook endpoint & signature verification
├── queue/
│   ├── queue.js         # BullMQ queue instance setup
│   └── worker.js        # Background worker processing jobs
├── services/
│   ├── aiReviewer.js    # Gemini AI thin adapter
   └── github.js        # Octokit auth & diff retrieval / comment posting
└── utils/
    └── rateLimiter.js   # Daily per-repo rate limit tracking

tests/
├── unit/                # Signature verification & diff parser tests
└── integration/         # Webhook & queue integration tests
```

**Structure Decision**: Single project Node.js application split cleanly into web server (`src/index.js`), queue worker (`src/queue/worker.js`), and isolated service adapters (`src/services/`).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| BullMQ Queue + Redis | Prevents webhook HTTP timeouts & enables retries | Direct inline processing blocks Express thread & loses failed jobs |
