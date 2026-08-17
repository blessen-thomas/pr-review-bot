# Feature Specification: AI PR Reviewer Bot

**Feature Branch**: `001-ai-pr-reviewer`

**Created**: 2026-08-17

**Status**: Draft

**Input**: User description: "AI PR Reviewer Bot with Gemini API and BullMQ queue"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automatic Inline Code Review on Pull Request (Priority: P1)

When a developer opens or updates a Pull Request on GitHub, the bot asynchronously fetches the unified diff, analyzes line-by-line changes using the Gemini AI API, and posts structured inline comments detailing identified bugs, security vulnerabilities, or code improvements.

**Why this priority**: Core value proposition of the system; enables automated code quality checks without human delay.

**Independent Test**: Can be fully tested by sending a simulated GitHub `pull_request` webhook payload (`opened` or `synchronize`) with a target diff and verifying that inline review comments are posted to GitHub.

**Acceptance Scenarios**:

1. **Given** a valid HMAC-signed `pull_request` webhook (`opened`), **When** received by the webhook endpoint, **Then** the job is enqueued in BullMQ and responds immediately with HTTP 202 (`queued`).
2. **Given** an enqueued PR review job, **When** processed by the queue worker, **Then** the bot retrieves the diff via Octokit, invokes Gemini AI, parses structured JSON findings, and posts inline review comments back to the PR.

---

### User Story 2 - Operational Guardrails & Rate Limits (Priority: P2)

When a PR diff exceeds safe size thresholds (`MAX_DIFF_LINES`) or a repository exceeds its daily quota (`MAX_REVIEWS_PER_REPO_PER_DAY`), the worker safely skips processing and logs the event without failing or throwing unhandled errors.

**Why this priority**: Prevents runaway LLM API costs, exhaustion of free-tier quotas, and queue congestion caused by giant diffs.

**Independent Test**: Can be tested independently by queueing jobs for diffs exceeding max line counts or for repos exceeding daily caps and verifying the job returns skipped status without making Gemini API calls.

**Acceptance Scenarios**:

1. **Given** a PR diff with changed lines exceeding `MAX_DIFF_LINES`, **When** processed by the worker, **Then** the worker skips Gemini API invocation and records `{ skipped: 'diff-too-large' }`.
2. **Given** a repository that has reached its `MAX_REVIEWS_PER_REPO_PER_DAY` limit, **When** a new webhook arrives, **Then** the worker skips review generation and records `{ skipped: 'daily-cap' }`.

---

### User Story 3 - Secure Webhook Authentication & Signature Validation (Priority: P3)

All incoming webhook HTTP requests must be authenticated using SHA256 HMAC signature verification against `GITHUB_WEBHOOK_SECRET`.

**Why this priority**: Protects the server and queue infrastructure from unauthorized payloads or denial-of-service spam.

**Independent Test**: Can be tested by posting HTTP requests to `/webhook` with valid, invalid, and missing `x-hub-signature-256` headers and asserting HTTP 202 or HTTP 401 response codes.

**Acceptance Scenarios**:

1. **Given** an incoming webhook request with an invalid signature, **When** processed by `/webhook`, **Then** the server responds with HTTP 401 `invalid signature` and does not enqueue a job.

---

### Edge Cases

- What happens when Gemini returns markdown code blocks around JSON findings? -> Defensively strip fences before parsing.
- What happens when a diff has no changed lines or zero findings? -> Log completion with 0 findings and skip posting empty reviews.
- What happens when GitHub API rate-limits diff retrieval or review posting? -> Queue job fails gracefully, triggering BullMQ exponential backoff retries.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST authenticate all incoming GitHub webhooks via HMAC-SHA256 signature verification.
- **FR-002**: System MUST immediately respond HTTP 202 to valid PR webhooks and enqueue processing jobs in BullMQ (Redis).
- **FR-003**: Queue workers MUST retrieve the PR diff via Octokit authentication using installation tokens.
- **FR-004**: System MUST pass unified diffs to the Gemini AI API thin adapter (`reviewDiff`) and extract structured findings (`file`, `line`, `severity`, `comment`).
- **FR-005**: System MUST post structured findings as inline review comments on the target PR using `@octokit/rest`.
- **FR-006**: System MUST enforce `MAX_DIFF_LINES` to prevent sending giant diffs to the AI model.
- **FR-007**: System MUST enforce `MAX_REVIEWS_PER_REPO_PER_DAY` per repository.

### Key Entities

- **Webhook Event**: Represents an incoming GitHub `pull_request` event containing installation ID, owner, repo, pull number, and head SHA.
- **Review Job**: Queued BullMQ task containing payload parameters for asynchronous execution.
- **AI Finding**: Structured review item containing file path, line number, severity level (`info` | `warning` | `critical`), and descriptive comment text.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Webhook endpoint responds to GitHub within 200ms by offloading work to BullMQ.
- **SC-002**: 100% of invalid webhook signatures are rejected with HTTP 401 before reaching the queue.
- **SC-003**: Valid PRs receive inline review comments on GitHub within 15 seconds of webhook receipt.
- **SC-004**: Diffs larger than `MAX_DIFF_LINES` are skipped without incurring LLM API cost or worker crashes.

## Assumptions

- Target GitHub App has `Pull requests: Read & write` and `Contents: Read-only` permissions.
- Redis server is available and accessible via environment configuration (`REDIS_HOST`, `REDIS_PORT`).
- Gemini API key (`GEMINI_API_KEY`) is active and within usage limits.
