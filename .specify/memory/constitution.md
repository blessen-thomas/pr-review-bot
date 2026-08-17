<!--
Sync Impact Report
- Version change: None -> 1.0.0 (Initial Ratification)
- List of modified principles:
  - [PRINCIPLE_1_NAME] -> I. Thin Adapter AI Architecture
  - [PRINCIPLE_2_NAME] -> II. Asynchronous Queue Processing & Resilience
  - [PRINCIPLE_3_NAME] -> III. Webhook Security & Payload Verification
  - [PRINCIPLE_4_NAME] -> IV. Operational Guardrails & Cost Protection
  - [PRINCIPLE_5_NAME] -> V. Structured Output & Inline GitHub Review Integration
- Added sections:
  - Technology Stack & Configuration Constraints
  - Quality Assurance & Verification Standards
- Removed sections: None
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md (Constitution Check alignment verified)
  - ✅ .specify/templates/spec-template.md (Requirements & security alignment verified)
  - ✅ .specify/templates/tasks-template.md (Task categorization alignment verified)
  - ✅ AGENTS.md (Runtime guidance aligned)
  - ✅ README.md (Architecture & guardrails aligned)
- Follow-up TODOs: None
-->

# AI PR Reviewer Constitution

## Core Principles

### I. Thin Adapter AI Architecture
The AI review provider interface (`src/services/aiReviewer.js`) MUST remain isolated as a thin adapter (`reviewDiff(diff) -> findings`). Core webhook receiver logic, payload validation, and job queue infrastructure MUST stay strictly decoupled from the specific LLM provider (e.g. Gemini, Claude, OpenAI) so that provider implementations can be swapped without affecting upstream or downstream services.

### II. Asynchronous Queue Processing & Resilience
All GitHub pull request webhooks MUST be acknowledged immediately with minimal latency. Heavy lifting—including fetching diffs, invoking AI APIs, and posting comments—MUST be offloaded to an asynchronous Redis/BullMQ worker queue. Worker jobs MUST implement exponential backoff retries to gracefully handle transient provider outages and API rate limits.

### III. Webhook Security & Payload Verification
All incoming HTTP webhook requests MUST be validated against the configured `GITHUB_WEBHOOK_SECRET` using HMAC-SHA256 signature verification before any job is accepted or queued. Requests with invalid or missing signatures MUST be rejected immediately with appropriate HTTP 401/403 status codes.

### IV. Operational Guardrails & Cost Protection
The application MUST enforce hard limits to protect against unexpected cost spikes and rate-limit exhaustion. Specifically:
- Diffs exceeding `MAX_DIFF_LINES` MUST be skipped prior to sending prompts to the LLM API.
- Daily per-repository review caps (`MAX_REVIEWS_PER_REPO_PER_DAY`) MUST be enforced to restrict runaway automated usage.

### V. Structured Output & Inline GitHub Review Integration
AI review outputs MUST strictly conform to a structured findings schema (`file`, `line`, `severity`, `comment`). Findings MUST be formatted into precise inline review comments and posted back to the target pull request using Octokit API credentials.

## Technology Stack & Configuration Constraints

- **Runtime & Environment**: Node.js (>=18), CommonJS module system (`"type": "commonjs"`).
- **Core Dependencies**: Express (webhooks), BullMQ & ioredis (job queue), `@google/generative-ai` (Gemini API adapter), `@octokit/rest` & `@octokit/auth-app` (GitHub App integration).
- **Secret Management**: API keys, webhook secrets, App IDs, and private keys MUST be supplied exclusively via environment variables (`dotenv`). Hardcoding secrets in source files or committing credentials to Git is strictly forbidden.

## Quality Assurance & Verification Standards

- **Test Discipline**: Webhook signature verification, queue job creation, diff line parsing, and AI finding schema validation MUST be covered by unit/integration testing before release.
- **Observability & Logging**: Server and worker processes MUST produce structured log outputs for job failures, API retries, skipped diffs, and rate-limit triggers. Silent exception catching is prohibited.

## Governance

- This Constitution supersedes all ad-hoc development practices for the AI PR Reviewer project.
- Any modifications to these principles require a formal amendment process and version increment:
  - **MAJOR**: Structural redefinitions or principle removals breaking existing architecture guidelines.
  - **MINOR**: Addition of new principles, tech stack additions, or expanded quality standards.
  - **PATCH**: Non-semantic clarifications, typo fixes, or wording refinements.
- Runtime development guidance resides in [AGENTS.md](file:///d:/Downloads/pr-review-bot_1/pr-review-bot/AGENTS.md) and [README.md](file:///d:/Downloads/pr-review-bot_1/pr-review-bot/README.md).

**Version**: 1.0.0 | **Ratified**: 2026-08-17 | **Last Amended**: 2026-08-17
